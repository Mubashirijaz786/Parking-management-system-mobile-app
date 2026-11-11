import { create } from 'zustand';
import { initializeDatabase } from '@/src/database/db';
import { getSettings } from '@/src/database/repository';

type State = { ready: boolean; businessName: string; licenseExpired: boolean; refreshKey: number; initialize: () => void; refresh: () => void };
export const useAppStore = create<State>((set) => ({ ready:false, businessName:'ParkEase', licenseExpired:false, refreshKey:0, initialize:()=>{ initializeDatabase(); const s=getSettings(); set({ready:true,businessName:s.business_name,licenseExpired:false}); }, refresh:()=>set((s)=>({refreshKey:s.refreshKey+1})) }));
