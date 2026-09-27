/**
 * Canonical list of all 64 districts in Bangladesh with English and Bengali labels.
 *
 * Ordering:
 * 1. Chattogram (inside_chattogram = ৳60)
 * 2. Dhaka (outside_chattogram = ৳100)
 * 3..64 Remaining districts sorted alphabetically A–Z (outside_chattogram = ৳100)
 *
 * Clean display names without bracketed alternatives.
 */
export interface DistrictOption {
  value: string; // Canonical identifier matching server lookup
  labelEn: string;
  labelBn: string;
}

export const BANGLADESH_DISTRICTS: DistrictOption[] = [
  // 1. First: Chattogram
  { value: 'Chattogram', labelEn: 'Chattogram', labelBn: 'চট্টগ্রাম' },

  // 2. Second: Dhaka
  { value: 'Dhaka', labelEn: 'Dhaka', labelBn: 'ঢাকা' },

  // Remaining 62 districts in alphabetical order (A–Z)
  { value: 'Bagerhat', labelEn: 'Bagerhat', labelBn: 'বাগেরহাট' },
  { value: 'Bandarban', labelEn: 'Bandarban', labelBn: 'বান্দরবান' },
  { value: 'Barguna', labelEn: 'Barguna', labelBn: 'বরগুনা' },
  { value: 'Barishal', labelEn: 'Barishal', labelBn: 'বরিশাল' },
  { value: 'Bhola', labelEn: 'Bhola', labelBn: 'ভোলা' },
  { value: 'Bogura', labelEn: 'Bogura', labelBn: 'বগুড়া' },
  { value: 'Brahmanbaria', labelEn: 'Brahmanbaria', labelBn: 'ব্রাহ্মণবাড়িয়া' },
  { value: 'Chandpur', labelEn: 'Chandpur', labelBn: 'চাঁদপুর' },
  { value: 'Chapai Nawabganj', labelEn: 'Chapai Nawabganj', labelBn: 'চাঁপাইনবাবগঞ্জ' },
  { value: 'Chuadanga', labelEn: 'Chuadanga', labelBn: 'চুয়াডাঙ্গা' },
  { value: 'Cox\'s Bazar', labelEn: 'Cox\'s Bazar', labelBn: 'কক্সবাজার' },
  { value: 'Cumilla', labelEn: 'Cumilla', labelBn: 'কুমিল্লা' },
  { value: 'Dinajpur', labelEn: 'Dinajpur', labelBn: 'দিনাজপুর' },
  { value: 'Faridpur', labelEn: 'Faridpur', labelBn: 'ফরিদপুর' },
  { value: 'Feni', labelEn: 'Feni', labelBn: 'ফেনী' },
  { value: 'Gaibandha', labelEn: 'Gaibandha', labelBn: 'গাইবান্ধা' },
  { value: 'Gazipur', labelEn: 'Gazipur', labelBn: 'গাজীপুর' },
  { value: 'Gopalganj', labelEn: 'Gopalganj', labelBn: 'গোপালগঞ্জ' },
  { value: 'Habiganj', labelEn: 'Habiganj', labelBn: 'হবিগঞ্জ' },
  { value: 'Jamalpur', labelEn: 'Jamalpur', labelBn: 'জামালপুর' },
  { value: 'Jashore', labelEn: 'Jashore', labelBn: 'যশোর' },
  { value: 'Jhalokathi', labelEn: 'Jhalokathi', labelBn: 'ঝালকাঠি' },
  { value: 'Jhenaidah', labelEn: 'Jhenaidah', labelBn: 'ঝিনাইদহ' },
  { value: 'Joypurhat', labelEn: 'Joypurhat', labelBn: 'জয়পুরহাট' },
  { value: 'Khagrachhari', labelEn: 'Khagrachhari', labelBn: 'খাগড়াছড়ি' },
  { value: 'Khulna', labelEn: 'Khulna', labelBn: 'খুলনা' },
  { value: 'Kishoreganj', labelEn: 'Kishoreganj', labelBn: 'কিশোরগঞ্জ' },
  { value: 'Kurigram', labelEn: 'Kurigram', labelBn: 'কুড়িগ্রাম' },
  { value: 'Kushtia', labelEn: 'Kushtia', labelBn: 'কুষ্টিয়া' },
  { value: 'Lakshmipur', labelEn: 'Lakshmipur', labelBn: 'লক্ষ্মীপুর' },
  { value: 'Lalmonirhat', labelEn: 'Lalmonirhat', labelBn: 'লালমনিরহাট' },
  { value: 'Madaripur', labelEn: 'Madaripur', labelBn: 'মাদারীপুর' },
  { value: 'Magura', labelEn: 'Magura', labelBn: 'মাগুরা' },
  { value: 'Manikganj', labelEn: 'Manikganj', labelBn: 'মানিকগঞ্জ' },
  { value: 'Meherpur', labelEn: 'Meherpur', labelBn: 'মেহেরপুর' },
  { value: 'Moulvibazar', labelEn: 'Moulvibazar', labelBn: 'মৌলভীবাজার' },
  { value: 'Munshiganj', labelEn: 'Munshiganj', labelBn: 'মুন্সীগঞ্জ' },
  { value: 'Mymensingh', labelEn: 'Mymensingh', labelBn: 'ময়মনসিংহ' },
  { value: 'Naogaon', labelEn: 'Naogaon', labelBn: 'নওগাঁ' },
  { value: 'Narail', labelEn: 'Narail', labelBn: 'নড়াইল' },
  { value: 'Narayanganj', labelEn: 'Narayanganj', labelBn: 'নারায়ণগঞ্জ' },
  { value: 'Narsingdi', labelEn: 'Narsingdi', labelBn: 'নরসিংদী' },
  { value: 'Natore', labelEn: 'Natore', labelBn: 'নাটোর' },
  { value: 'Netrokona', labelEn: 'Netrokona', labelBn: 'নেত্রকোণা' },
  { value: 'Nilphamari', labelEn: 'Nilphamari', labelBn: 'নীলফামারী' },
  { value: 'Noakhali', labelEn: 'Noakhali', labelBn: 'নোয়াখালী' },
  { value: 'Pabna', labelEn: 'Pabna', labelBn: 'পাবনা' },
  { value: 'Panchagarh', labelEn: 'Panchagarh', labelBn: 'পঞ্চগড়' },
  { value: 'Patuakhali', labelEn: 'Patuakhali', labelBn: 'পটুয়াখালী' },
  { value: 'Pirojpur', labelEn: 'Pirojpur', labelBn: 'পিরোজপুর' },
  { value: 'Rajbari', labelEn: 'Rajbari', labelBn: 'রাজবাড়ী' },
  { value: 'Rajshahi', labelEn: 'Rajshahi', labelBn: 'রাজশাহী' },
  { value: 'Rangamati', labelEn: 'Rangamati', labelBn: 'রাঙ্গামাটি' },
  { value: 'Rangpur', labelEn: 'Rangpur', labelBn: 'রংপুর' },
  { value: 'Satkhira', labelEn: 'Satkhira', labelBn: 'সাতক্ষীরা' },
  { value: 'Shariatpur', labelEn: 'Shariatpur', labelBn: 'শরীয়তপুর' },
  { value: 'Sherpur', labelEn: 'Sherpur', labelBn: 'শেরপুর' },
  { value: 'Sirajganj', labelEn: 'Sirajganj', labelBn: 'সিরাজগঞ্জ' },
  { value: 'Sunamganj', labelEn: 'Sunamganj', labelBn: 'সুনামগঞ্জ' },
  { value: 'Sylhet', labelEn: 'Sylhet', labelBn: 'সিলেট' },
  { value: 'Tangail', labelEn: 'Tangail', labelBn: 'টাঙ্গাইল' },
  { value: 'Thakurgaon', labelEn: 'Thakurgaon', labelBn: 'ঠাকুরগাঁও' },
];
