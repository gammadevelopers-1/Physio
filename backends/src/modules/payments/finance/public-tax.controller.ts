import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/decorators';
import { TaxComputationService } from '../services/tax-computation.service';

/**
 * Unauthenticated read of the tax display fields — used by the public
 * storefront cart + checkout so they can show the correct VAT rate
 * without making per-page admin calls. Returns only the three fields
 * the cart needs; never leaks the tax registration number or any
 * admin-only data.
 */
@Public()
@Controller('public/tax')
export class PublicTaxController {
  constructor(private readonly taxComputationService: TaxComputationService) {}

  @Get('display')
  async getDisplay() {
    return this.taxComputationService.getPublicDisplay();
  }
}
