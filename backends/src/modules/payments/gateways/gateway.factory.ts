import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentGateway, GatewayHealthResult } from './payment-gateway.interface';
import { MockGateway } from './mock.gateway';
import { MoyasarGateway } from './moyasar.gateway';
import { TamaraGateway } from './tamara.gateway';
import { TabbyGateway } from './tabby.gateway';
import { BankTransferGateway } from './bank-transfer.gateway';
import { GatewayCredentialsService } from './gateway-credentials.service';

@Injectable()
export class GatewayFactory {
  private readonly logger = new Logger(GatewayFactory.name);
  private readonly gateways = new Map<string, PaymentGateway>();

  constructor(
    private readonly credentials: GatewayCredentialsService,
    private readonly mockGateway: MockGateway,
    private readonly moyasarGateway: MoyasarGateway,
    private readonly tamaraGateway: TamaraGateway,
    private readonly tabbyGateway: TabbyGateway,
    private readonly bankTransferGateway: BankTransferGateway,
  ) {
    this.registerGateways();
  }

  private registerGateways(): void {
    // Mock gateway always available (dev/staging fallback).
    this.gateways.set('mock', this.mockGateway);
    this.logger.log('Registered MockGateway');

    // Bank Transfer is always available — no credentials needed; finance
    // configures bank account info via system_settings.
    this.gateways.set('bank_transfer', this.bankTransferGateway);
    this.logger.log('Registered BankTransferGateway');

    // API-driven gateways register when credentials exist in EITHER env or
    // system_settings.payments. We let admin save credentials via the UI
    // and have them go live without redeploying.
    if (this.credentials.getMoyasar().secretKey) {
      this.gateways.set('moyasar', this.moyasarGateway);
      this.logger.log('Registered MoyasarGateway');
    }

    if (this.credentials.getTamara().apiToken) {
      this.gateways.set('tamara', this.tamaraGateway);
      this.logger.log('Registered TamaraGateway');
    }

    if (this.credentials.getTabby().secretKey) {
      this.gateways.set('tabby', this.tabbyGateway);
      this.logger.log('Registered TabbyGateway');
    }

    this.logger.log(
      `Payment gateways registered: [${Array.from(this.gateways.keys()).join(', ')}]`,
    );
  }

  /**
   * Re-evaluate registration when admin saves new credentials. Called from
   * the GatewayCredentialsService's change listener so a previously-empty
   * gateway becomes available immediately after admin pastes keys.
   */
  refreshRegistration(): void {
    // Re-register if creds now exist; never DROP a gateway here — payments in
    // flight against an existing gateway should complete, not 404.
    if (!this.gateways.has('moyasar') && this.credentials.getMoyasar().secretKey) {
      this.gateways.set('moyasar', this.moyasarGateway);
      this.logger.log('Late-registered MoyasarGateway after credential save');
    }
    if (!this.gateways.has('tamara') && this.credentials.getTamara().apiToken) {
      this.gateways.set('tamara', this.tamaraGateway);
      this.logger.log('Late-registered TamaraGateway after credential save');
    }
    if (!this.gateways.has('tabby') && this.credentials.getTabby().secretKey) {
      this.gateways.set('tabby', this.tabbyGateway);
      this.logger.log('Late-registered TabbyGateway after credential save');
    }
  }

  getGateway(name: string): PaymentGateway {
    let gateway = this.gateways.get(name);
    if (!gateway) {
      // Maybe admin just saved credentials — try late registration before
      // failing. Cheap (sync) so the cost is negligible per call.
      this.refreshRegistration();
      gateway = this.gateways.get(name);
    }
    if (!gateway) {
      throw new NotFoundException(
        `Payment gateway '${name}' is not available. Available: [${Array.from(this.gateways.keys()).join(', ')}]`,
      );
    }
    return gateway;
  }

  getAvailableGateways(): string[] {
    this.refreshRegistration();
    return Array.from(this.gateways.keys());
  }

  async healthCheckAll(): Promise<GatewayHealthResult[]> {
    const checks = Array.from(this.gateways.values()).map(gw =>
      gw.healthCheck().catch(err => ({
        gateway: gw.name,
        status: 'down' as const,
        error: err.message,
        checkedAt: new Date(),
      })),
    );
    return Promise.all(checks);
  }
}
