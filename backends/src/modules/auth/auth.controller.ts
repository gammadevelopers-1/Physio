import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  Headers,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import {
  RegisterDto,
  LoginDto,
  SwitchRoleDto,
  AssignRoleDto,
  CreateUserDto,
  UpdateUserDto,
  CreateRoleDto,
  UpdateRoleDto,
  Verify2FADto,
  Toggle2FADto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from './guards';
import { CurrentUser, Public, Roles } from './decorators';
import { UserRole, RoleName } from '../../database/schema';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
  ) {}

  // Helper: set refresh token cookie
  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
  }

  // Helper: clear refresh token cookie
  private clearRefreshCookie(res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/api/auth',
    });
  }

  // ===========================================
  // Register
  // ===========================================
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ===========================================
  // Login (with 2FA support)
  // ===========================================
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-device-id') deviceId?: string,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    // Step 1: Validate credentials (returns user + tokens)
    const result = await this.authService.login(dto, ipAddress, userAgent);
    const userId = result.user.id as string;

    // Step 2: Check if 2FA is required for this device
    const is2FAEnabled = await this.twoFactorService.is2FAEnabled(userId);

    if (is2FAEnabled && deviceId) {
      const fingerprint = this.twoFactorService.generateFingerprint(
        userAgent,
        deviceId,
      );

      const isTrusted = await this.twoFactorService.isDeviceTrusted(
        userId,
        fingerprint,
      );

      if (!isTrusted) {
        // Revoke the refresh token that login() just created (we don't want it yet)
        await this.authService.logout(result.refreshToken);

        // Create 2FA challenge → sends OTP email
        const challengeId = await this.twoFactorService.createChallenge(
          userId,
          fingerprint,
          result.user.email as string,
          userAgent,
        );

        return {
          requiresTwoFactor: true,
          challengeId,
        };
      }
    }

    // Device trusted (or 2FA off, or no device-id) → normal login
    this.setRefreshCookie(res, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  // ===========================================
  // Verify 2FA OTP
  // ===========================================
  @Public()
  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  async verify2FA(
    @Body() dto: Verify2FADto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection.remoteAddress || '';

    // Verify OTP → returns userId + fingerprint from the challenge
    const { userId, fingerprint } =
      await this.twoFactorService.verifyChallenge(
        dto.challengeId,
        dto.code,
        '', // fingerprint not needed for verification (stored in challenge)
      );

    // Trust this device for future logins
    const deviceName = this.twoFactorService.parseDeviceName(userAgent);
    await this.twoFactorService.trustDevice(
      userId,
      fingerprint,
      deviceName,
      ipAddress,
    );

    // Issue real tokens now that 2FA is complete
    const loginResult = await this.authService.issueTokensForUser(
      userId,
      ipAddress,
      userAgent,
    );

    this.setRefreshCookie(res, loginResult.refreshToken);

    return {
      user: loginResult.user,
      accessToken: loginResult.accessToken,
    };
  }

  // ===========================================
  // Resend 2FA OTP
  // ===========================================
  @Public()
  @Post('resend-2fa')
  @HttpCode(HttpStatus.OK)
  async resend2FA(
    @Body() body: { challengeId: string },
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || '';

    const challengeInfo = await this.authService.getChallengeUserInfo(
      body.challengeId,
    );

    if (!challengeInfo) {
      // Don't reveal whether the challenge exists
      return { message: 'If a valid session exists, a new code has been sent.' };
    }

    const newChallengeId = await this.twoFactorService.createChallenge(
      challengeInfo.userId,
      challengeInfo.fingerprint,
      challengeInfo.email,
      userAgent,
    );

    return { challengeId: newChallengeId };
  }

  // ===========================================
  // Get Trusted Devices
  // ===========================================
  @UseGuards(JwtAuthGuard)
  @Get('trusted-devices')
  async getTrustedDevices(@CurrentUser('id') userId: string) {
    return this.twoFactorService.getUserTrustedDevices(userId);
  }

  // ===========================================
  // Revoke One Trusted Device
  // ===========================================
  @UseGuards(JwtAuthGuard)
  @Delete('trusted-devices/:id')
  async revokeDevice(
    @CurrentUser('id') userId: string,
    @Param('id') deviceId: string,
  ) {
    await this.twoFactorService.revokeDevice(userId, deviceId);
    return { message: 'Device revoked successfully' };
  }

  // ===========================================
  // Revoke All Trusted Devices
  // ===========================================
  @UseGuards(JwtAuthGuard)
  @Delete('trusted-devices')
  async revokeAllDevices(@CurrentUser('id') userId: string) {
    await this.twoFactorService.revokeAllDevices(userId);
    return { message: 'All devices revoked successfully' };
  }

  // ===========================================
  // Toggle 2FA
  // ===========================================
  @UseGuards(JwtAuthGuard)
  @Post('2fa/toggle')
  @HttpCode(HttpStatus.OK)
  async toggle2FA(
    @CurrentUser('id') userId: string,
    @Body() dto: Toggle2FADto,
  ) {
    return this.twoFactorService.toggle2FA(userId, dto.enabled);
  }

  // ===========================================
  // Get 2FA Status
  // ===========================================
  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  async get2FAStatus(@CurrentUser('id') userId: string) {
    const enabled = await this.twoFactorService.is2FAEnabled(userId);
    return { twoFactorEnabled: enabled };
  }

  // ===========================================
  // Logout
  // ===========================================
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    this.clearRefreshCookie(res);
    return { message: 'Logged out successfully' };
  }

  // ===========================================
  // Refresh Token
  // ===========================================
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldRefreshToken = req.cookies?.refreshToken;

    if (!oldRefreshToken) {
      return { error: 'No refresh token provided' };
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.refreshTokens(
      oldRefreshToken,
      ipAddress,
      userAgent,
    );

    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  // ===========================================
  // Get Current User (with all roles)
  // ===========================================
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser('id') userId: string) {
    return this.authService.getCurrentUser(userId);
  }

  // ===========================================
  // Switch Role
  // ===========================================
  @UseGuards(JwtAuthGuard)
  @Post('switch-role')
  @HttpCode(HttpStatus.OK)
  async switchRole(
    @CurrentUser('id') userId: string,
    @Body() dto: SwitchRoleDto,
  ) {
    return this.authService.switchRole(userId, dto.role as RoleName);
  }

  // ===========================================
  // Get My Roles
  // ===========================================
  @UseGuards(JwtAuthGuard)
  @Get('my-roles')
  async getMyRoles(@CurrentUser('id') userId: string) {
    const roles = await this.authService.getUserRoles(userId);
    return { roles };
  }

  // ===========================================
  // Logout All Devices
  // ===========================================
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAllDevices(userId);
    this.clearRefreshCookie(res);
    return { message: 'Logged out from all devices' };
  }

  // ===========================================
  // ADMIN ENDPOINTS
  // ===========================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('users')
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('users/:id/roles')
  async getUserRoles(@Param('id') userId: string) {
    const roles = await this.authService.getUserRoles(userId);
    return { userId, roles };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Post('users/:id/roles')
  async assignRole(
    @Param('id') userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.authService.assignRole(userId, dto.role as RoleName, adminId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Delete('users/:id/roles/:role')
  async removeRole(
    @Param('id') userId: string,
    @Param('role') role: string,
  ) {
    return this.authService.removeRole(userId, role as RoleName);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Post('users')
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.authService.createUser(dto, adminId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Patch('users/:id')
  async updateUser(
    @Param('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.authService.updateUser(userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Delete('users/:id')
  async deleteUser(
    @Param('id') userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.authService.deleteUser(userId, adminId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('roles')
  async getAllRoles() {
    return this.authService.getAllRoles();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Post('roles')
  async createRole(@Body() dto: CreateRoleDto) {
    return this.authService.createRole(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Patch('roles/:id')
  async updateRole(
    @Param('id') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.authService.updateRole(roleId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Delete('roles/:id')
  async deleteRole(@Param('id') roleId: string) {
    return this.authService.deleteRole(roleId);
  }
}
