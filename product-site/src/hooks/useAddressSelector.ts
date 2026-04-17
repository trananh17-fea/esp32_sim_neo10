import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Province {
 name: string;
 code: number;
 division_type: string;
 codename: string;
 phone_code: number;
}

export interface District {
 name: string;
 code: number;
 division_type: string;
 codename: string;
 wards: Ward[];
}

export interface Ward {
 name: string;
 code: number;
 division_type: string;
 codename: string;
}

interface SelectedAddress {
 province: Province | null;
 district: District | null;
 ward: Ward | null;
}

interface UseAddressSelectorReturn {
 provinces: Province[];
 districts: District[];
 wards: Ward[];
 selected: SelectedAddress;
 loading: { provinces: boolean; districts: boolean; wards: boolean };
 error: string | null;
 fullAddress: string;
 isValid: boolean;
 init: () => Promise<void>;
 selectProvince: (province: Province | null) => void;
 selectDistrict: (district: District | null) => void;
 selectWard: (ward: Ward | null) => void;
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const cache: Record<string, unknown> = {};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAddressSelector(detailAddress: string): UseAddressSelectorReturn {
 const [provinces, setProvinces] = useState<Province[]>([]);
 const [districts, setDistricts] = useState<District[]>([]);
 const [wards, setWards] = useState<Ward[]>([]);
 const [loading, setLoading] = useState({ provinces: false, districts: false, wards: false });
 const [error, setError] = useState<string | null>(null);
 const [selected, setSelected] = useState<SelectedAddress>({
 province: null,
 district: null,
 ward: null,
 });

 // ── Fetch helpers ──────────────────────────────────────────────────────────
 async function fetchProvinces(): Promise<Province[]> {
 const url = "https://provinces.open-api.vn/api/?depth=1";
 if (cache[url]) return cache[url] as Province[];
 const res = await fetch(url);
 if (!res.ok) throw new Error(`API error: ${res.status}`);
 const data: Province[] = await res.json();
 cache[url] = data;
 return data;
 }

 async function fetchDistricts(provinceCode: number): Promise<District[]> {
 const url = `https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`;
 if (cache[url]) return cache[url] as District[];
 const res = await fetch(url);
 if (!res.ok) throw new Error(`API error: ${res.status}`);
 const data = await res.json();
 const list: District[] = data.districts ?? [];
 cache[url] = list;
 return list;
 }

 async function fetchWards(districtCode: number): Promise<Ward[]> {
 const url = `https://provinces.open-api.vn/api/d/${districtCode}?depth=2`;
 if (cache[url]) return cache[url] as Ward[];
 const res = await fetch(url);
 if (!res.ok) throw new Error(`API error: ${res.status}`);
 const data = await res.json();
 const list: Ward[] = data.wards ?? [];
 cache[url] = list;
 return list;
 }

 // ── Initialise: load provinces on first mount ────────────────────────────────
 const init = useCallback(async () => {
 if (provinces.length > 0) return;
 setLoading((l) => ({ ...l, provinces: true }));
 setError(null);
 try {
 const data = await fetchProvinces();
 setProvinces(data);
 } catch (e) {
 setError("Không thể tải danh sách tỉnh/thành phố. Vui lòng thử lại.");
 console.error(e);
 } finally {
 setLoading((l) => ({ ...l, provinces: false }));
 }
 }, [provinces.length]);

 useEffect(() => {
 void init();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // ── Selectors ────────────────────────────────────────────────────────────────
 function selectProvince(province: Province | null) {
 setSelected({ province, district: null, ward: null });
 setDistricts([]);
 setWards([]);
 if (!province) return;
 setLoading((l) => ({ ...l, districts: true }));
 void fetchDistricts(province.code)
 .then(setDistricts)
 .catch((e) => { console.error(e); setDistricts([]); })
 .finally(() => setLoading((l) => ({ ...l, districts: false })));
 }

 function selectDistrict(district: District | null) {
 setSelected((prev) => ({ ...prev, district, ward: null }));
 setWards([]);
 if (!district) return;
 setLoading((l) => ({ ...l, wards: true }));
 void fetchWards(district.code)
 .then(setWards)
 .catch((e) => { console.error(e); setWards([]); })
 .finally(() => setLoading((l) => ({ ...l, wards: false })));
 }

 function selectWard(ward: Ward | null) {
 setSelected((prev) => ({ ...prev, ward }));
 }

 // ── Full address string ─────────────────────────────────────────────────────
 const fullAddress = [
 detailAddress,
 selected.ward?.name,
 selected.district?.name,
 selected.province?.name,
 ]
 .filter(Boolean)
 .join(", ");

 const isValid =
 Boolean(selected.province) &&
 Boolean(selected.district) &&
 Boolean(selected.ward) &&
 detailAddress.trim().length > 0;

 return {
  provinces,
 districts,
 wards,
 selected,
 loading,
 error,
 fullAddress,
 isValid,
 init,
 selectProvince,
 selectDistrict,
 selectWard,
 };
}