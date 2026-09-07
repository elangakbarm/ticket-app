import { Module } from '@nestjs/common';
import { ServiceCaller } from './service-caller.service';
import { BookingsGatewayController } from './bookings-gateway.controller';
import { PaymentsGatewayController } from './payments-gateway.controller';

@Module({
  controllers: [BookingsGatewayController, PaymentsGatewayController],
  providers: [ServiceCaller],
  exports: [ServiceCaller],
})
export class ServiceGatewayModule {}
