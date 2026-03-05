import {
  IsArray,
  IsString,
  IsInt,
  IsOptional,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class WatchEventItem {
  @IsString()
  @IsIn(['play', 'pause', 'seek', 'heartbeat', 'complete', 'buffer'])
  eventType: string;

  @IsInt()
  position: number;

  @IsOptional()
  @IsInt()
  fromPosition?: number;
}

export class BatchWatchEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WatchEventItem)
  events: WatchEventItem[];
}
