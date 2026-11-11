export type VehicleType = 'bike' | 'car' | 'rickshaw' | 'van' | 'truck';
export type PricingModel = 'fixed' | 'hourly' | 'custom';
export type PaymentStatus = 'paid' | 'unpaid' | 'partial';
export type PaymentMethod = 'cash' | 'digital' | 'card' | 'other';
export type TicketStatus = 'active' | 'exited' | 'cancelled';

export type RateSnapshot = { model: PricingModel; baseRate: number; hourlyRate: number; graceMinutes: number; minimumCharge: number; maximumDailyCharge: number };
export type Ticket = {
  id: string; plate: string; normalizedPlate: string; vehicleType: VehicleType; entryAt: string; exitAt?: string | null;
  status: TicketStatus; amount: number; paymentStatus: PaymentStatus; paymentMethod?: PaymentMethod | null;
  paidAt?: string | null; qrPayload: string; rateSnapshot: RateSnapshot; printingStatus: 'pending' | 'printed' | 'failed';
};
export type WatchlistMatch = { id: number; plate: string; category: VehicleType; makeModel?: string | null; color?: string | null; reason: string; source?: string | null; reference?: string | null; status: 'active' | 'resolved' };
