import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGateway, GatewayHealthResult } from './payment-gateway.interface';
import { MockGateway } from './mock.gateway';
import { MoyasarGateway } from './moyasar.gateway';
import { TamaraGateway } from './tamara.gateway';
import { TabbyGateway } from './tabby.gateway';
import { BankTransferGateway } from './bank-transfer.gateway';

@Injectable()
export class GatewayFactory {
  private readonly logger = new Logger(GatewayFactory.name);
  private readonly gateways = new Map<string, PaymentGateway>();

  constructor(
    private readonly configService: ConfigService,
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

    // Register API-driven gateways only when credentials exist.
    if (this.configService.get<string>('payments.moyasar.secretKey')) {
      this.gateways.set('moyasar', this.moyasarGateway);
      this.logger.log('Registered MoyasarGateway');
    }

    if (this.configService.get<string>('payments.tamara.apiToken')) {
      this.gateways.set('tamara', this.tamaraGateway);
      this.logger.log('Registered TamaraGateway');
    }

    if (this.configService.get<string>('payments.tabby.secretKey')) {
      this.gateways.set('tabby', this.tabbyGateway);
      this.logger.log('Registered TabbyGateway');
    }

    this.logger.log(
      `Payment gateways registered: [${Array.from(this.gateways.keys()).join(', ')}]`,
    );
  }

  getGateway(name: string): PaymentGateway {
    const gateway = this.gateways.get(name);
    if (!gateway) {
      throw new NotFoundException(
        `Payment gateway '${name}' is not available. Available: [${Array.from(this.gateways.keys()).join(', ')}]`,
      );
    }
    return gateway;
  }

  getAvailableGateways(): string[] {
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
