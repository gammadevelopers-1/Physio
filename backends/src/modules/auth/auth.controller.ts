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
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, SwitchRoleDto, AssignRoleDto, CreateUserDto, UpdateUserDto, CreateRoleDto, UpdateRoleDto } from './dto';
import { JwtAuthGuard, RolesGuard } from './guards';
import { CurrentUser, Public, Roles } from './decorators';
import { UserRole, RoleName } from '../../database/schema';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ===========================================
  // Register
  // ===========================================
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ===========================================
  // Login
  // ===========================================
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(dto, ipAddress, userAgent);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth',
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
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

    // Clear the cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/api/auth',
    });

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

    // Set new refresh token
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

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
  // Switch Role - Change active role
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

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/api/auth',
    });

    return { message: 'Logged out from all devices' };
  }

  // ===========================================
  // ADMIN ENDPOINTS
  // ===========================================

  // ===========================================
  // Admin: Get All Users
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('users')
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  // ===========================================
  // Admin: Get User's Roles
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('users/:id/roles')
  async getUserRoles(@Param('id') userId: string) {
    const roles = await this.authService.getUserRoles(userId);
    return { userId, roles };
  }

  // ===========================================
  // Admin: Assign Role to User
  // ===========================================
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

  // ===========================================
  // Admin: Remove Role from User
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Delete('users/:id/roles/:role')
  async removeRole(
    @Param('id') userId: string,
    @Param('role') role: string,
  ) {
    return this.authService.removeRole(userId, role as RoleName);
  }

  // ===========================================
  // Admin: Create User
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Post('users')
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.authService.createUser(dto, adminId);
  }

  // ===========================================
  // Admin: Update User
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Patch('users/:id')
  async updateUser(
    @Param('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.authService.updateUser(userId, dto);
  }

  // ===========================================
  // Admin: Delete User
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Delete('users/:id')
  async deleteUser(
    @Param('id') userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.authService.deleteUser(userId, adminId);
  }

  // ===========================================
  // Admin: Get All Roles (with user counts)
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('roles')
  async getAllRoles() {
    return this.authService.getAllRoles();
  }

  // ===========================================
  // Admin: Create Role
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Post('roles')
  async createRole(@Body() dto: CreateRoleDto) {
    return this.authService.createRole(dto);
  }

  // ===========================================
  // Admin: Update Role
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Patch('roles/:id')
  async updateRole(
    @Param('id') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.authService.updateRole(roleId, dto);
  }

  // ===========================================
  // Admin: Delete Role
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Delete('roles/:id')
  async deleteRole(@Param('id') roleId: string) {
    return this.authService.deleteRole(roleId);
  }
}
