import { IsUUID } from 'class-validator';

export class LinkTicketDto {
  @IsUUID()
  ticketId: string;
}
