import type { InstitutionType, Region } from '@/lib/types';

/** City → [state, region, 3-digit pincode prefix]. Pincode prefixes are approximate and only used for synthetic data. */
export const CITIES: { city: string; district: string; state: string; region: Region; pin: string; weight: number }[] = [
  { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', region: 'Southern', pin: '600', weight: 6 },
  { city: 'Coimbatore', district: 'Coimbatore', state: 'Tamil Nadu', region: 'Southern', pin: '641', weight: 4 },
  { city: 'Madurai', district: 'Madurai', state: 'Tamil Nadu', region: 'Southern', pin: '625', weight: 3 },
  { city: 'Tiruchirappalli', district: 'Tiruchirappalli', state: 'Tamil Nadu', region: 'Southern', pin: '620', weight: 2 },
  { city: 'Salem', district: 'Salem', state: 'Tamil Nadu', region: 'Southern', pin: '636', weight: 2 },
  { city: 'Puducherry', district: 'Puducherry', state: 'Puducherry', region: 'Southern', pin: '605', weight: 1 },
  { city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', region: 'Southern', pin: '500', weight: 5 },
  { city: 'Warangal', district: 'Warangal', state: 'Telangana', region: 'Southern', pin: '506', weight: 2 },
  { city: 'Vijayawada', district: 'Krishna', state: 'Andhra Pradesh', region: 'Southern', pin: '520', weight: 3 },
  { city: 'Visakhapatnam', district: 'Visakhapatnam', state: 'Andhra Pradesh', region: 'Southern', pin: '530', weight: 3 },
  { city: 'Guntur', district: 'Guntur', state: 'Andhra Pradesh', region: 'Southern', pin: '522', weight: 2 },
  { city: 'Bengaluru', district: 'Bengaluru Urban', state: 'Karnataka', region: 'South-Western', pin: '560', weight: 6 },
  { city: 'Mysuru', district: 'Mysuru', state: 'Karnataka', region: 'South-Western', pin: '570', weight: 2 },
  { city: 'Mangaluru', district: 'Dakshina Kannada', state: 'Karnataka', region: 'South-Western', pin: '575', weight: 2 },
  { city: 'Belagavi', district: 'Belagavi', state: 'Karnataka', region: 'South-Western', pin: '590', weight: 2 },
  { city: 'Kochi', district: 'Ernakulam', state: 'Kerala', region: 'South-Western', pin: '682', weight: 3 },
  { city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', state: 'Kerala', region: 'South-Western', pin: '695', weight: 2 },
  { city: 'Kozhikode', district: 'Kozhikode', state: 'Kerala', region: 'South-Western', pin: '673', weight: 2 },
  { city: 'Mumbai', district: 'Mumbai Suburban', state: 'Maharashtra', region: 'Western', pin: '400', weight: 5 },
  { city: 'Pune', district: 'Pune', state: 'Maharashtra', region: 'Western', pin: '411', weight: 6 },
  { city: 'Nagpur', district: 'Nagpur', state: 'Maharashtra', region: 'Western', pin: '440', weight: 3 },
  { city: 'Nashik', district: 'Nashik', state: 'Maharashtra', region: 'Western', pin: '422', weight: 2 },
  { city: 'Aurangabad', district: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', region: 'Western', pin: '431', weight: 2 },
  { city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', region: 'Western', pin: '380', weight: 4 },
  { city: 'Vadodara', district: 'Vadodara', state: 'Gujarat', region: 'Western', pin: '390', weight: 2 },
  { city: 'Surat', district: 'Surat', state: 'Gujarat', region: 'Western', pin: '395', weight: 2 },
  { city: 'Panaji', district: 'North Goa', state: 'Goa', region: 'Western', pin: '403', weight: 1 },
  { city: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh', region: 'Northern', pin: '226', weight: 4 },
  { city: 'Kanpur', district: 'Kanpur Nagar', state: 'Uttar Pradesh', region: 'Northern', pin: '208', weight: 2 },
  { city: 'Noida', district: 'Gautam Buddh Nagar', state: 'Uttar Pradesh', region: 'Northern', pin: '201', weight: 4 },
  { city: 'Varanasi', district: 'Varanasi', state: 'Uttar Pradesh', region: 'Northern', pin: '221', weight: 2 },
  { city: 'Prayagraj', district: 'Prayagraj', state: 'Uttar Pradesh', region: 'Northern', pin: '211', weight: 2 },
  { city: 'Dehradun', district: 'Dehradun', state: 'Uttarakhand', region: 'Northern', pin: '248', weight: 2 },
  { city: 'Bhopal', district: 'Bhopal', state: 'Madhya Pradesh', region: 'Central', pin: '462', weight: 3 },
  { city: 'Indore', district: 'Indore', state: 'Madhya Pradesh', region: 'Central', pin: '452', weight: 3 },
  { city: 'Jabalpur', district: 'Jabalpur', state: 'Madhya Pradesh', region: 'Central', pin: '482', weight: 2 },
  { city: 'Gwalior', district: 'Gwalior', state: 'Madhya Pradesh', region: 'Central', pin: '474', weight: 1 },
  { city: 'Raipur', district: 'Raipur', state: 'Chhattisgarh', region: 'Central', pin: '492', weight: 2 },
  { city: 'Bhilai', district: 'Durg', state: 'Chhattisgarh', region: 'Central', pin: '490', weight: 1 },
  { city: 'Kolkata', district: 'Kolkata', state: 'West Bengal', region: 'Eastern', pin: '700', weight: 4 },
  { city: 'Durgapur', district: 'Paschim Bardhaman', state: 'West Bengal', region: 'Eastern', pin: '713', weight: 2 },
  { city: 'Bhubaneswar', district: 'Khordha', state: 'Odisha', region: 'Eastern', pin: '751', weight: 3 },
  { city: 'Cuttack', district: 'Cuttack', state: 'Odisha', region: 'Eastern', pin: '753', weight: 1 },
  { city: 'Patna', district: 'Patna', state: 'Bihar', region: 'Eastern', pin: '800', weight: 2 },
  { city: 'Ranchi', district: 'Ranchi', state: 'Jharkhand', region: 'Eastern', pin: '834', weight: 2 },
  { city: 'Jamshedpur', district: 'East Singhbhum', state: 'Jharkhand', region: 'Eastern', pin: '831', weight: 1 },
  { city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan', region: 'North-Western', pin: '302', weight: 4 },
  { city: 'Jodhpur', district: 'Jodhpur', state: 'Rajasthan', region: 'North-Western', pin: '342', weight: 2 },
  { city: 'Udaipur', district: 'Udaipur', state: 'Rajasthan', region: 'North-Western', pin: '313', weight: 1 },
  { city: 'Chandigarh', district: 'Chandigarh', state: 'Chandigarh', region: 'North-Western', pin: '160', weight: 2 },
  { city: 'Ludhiana', district: 'Ludhiana', state: 'Punjab', region: 'North-Western', pin: '141', weight: 2 },
  { city: 'Amritsar', district: 'Amritsar', state: 'Punjab', region: 'North-Western', pin: '143', weight: 1 },
  { city: 'Gurugram', district: 'Gurugram', state: 'Haryana', region: 'North-Western', pin: '122', weight: 3 },
  { city: 'Faridabad', district: 'Faridabad', state: 'Haryana', region: 'North-Western', pin: '121', weight: 2 },
  { city: 'New Delhi', district: 'New Delhi', state: 'Delhi', region: 'North-Western', pin: '110', weight: 3 },
  { city: 'Shimla', district: 'Shimla', state: 'Himachal Pradesh', region: 'North-Western', pin: '171', weight: 1 },
  { city: 'Jammu', district: 'Jammu', state: 'Jammu and Kashmir', region: 'North-Western', pin: '180', weight: 1 },
  { city: 'Guwahati', district: 'Kamrup Metropolitan', state: 'Assam', region: 'North-Eastern', pin: '781', weight: 3 },
  { city: 'Silchar', district: 'Cachar', state: 'Assam', region: 'North-Eastern', pin: '788', weight: 1 },
  { city: 'Shillong', district: 'East Khasi Hills', state: 'Meghalaya', region: 'North-Eastern', pin: '793', weight: 1 },
  { city: 'Agartala', district: 'West Tripura', state: 'Tripura', region: 'North-Eastern', pin: '799', weight: 1 },
  { city: 'Imphal', district: 'Imphal West', state: 'Manipur', region: 'North-Eastern', pin: '795', weight: 1 },
];

/** Fictional name stems. Combined with prefixes and patterns they produce made-up institution names. */
export const STEMS = [
  'Kaveri', 'Narmada', 'Deccan', 'Himgiri', 'Vindhya', 'Godavari', 'Tapti', 'Sahyadri', 'Aravalli', 'Malabar', 'Konkan',
  'Vaigai', 'Palar', 'Shivalik', 'Lohit', 'Teesta', 'Mahanadi', 'Chambal', 'Tungabhadra', 'Sabari', 'Pennar', 'Kosi',
  'Gomti', 'Betwa', 'Damodar', 'Subarnarekha', 'Nilgiri', 'Satpura', 'Kanchan', 'Udayagiri', 'Shravasti', 'Avantika',
  'Kalinga', 'Magadha', 'Vidarbha', 'Saurashtra', 'Mewar', 'Kamarupa', 'Pragjyoti', 'Utkal', 'Purvanchal', 'Rohilkhand',
  'Annai', 'Thirumalai', 'Ponni', 'Kurinji', 'Mullai', 'Marutham', 'Neithal', 'Chitrakoot', 'Panchavati', 'Ujjayini',
  'Dhruva', 'Agastya', 'Bharadwaja', 'Vasishta', 'Gargi', 'Maitreyi', 'Lopamudra', 'Aryabhata', 'Varahamihira', 'Bhaskara',
  'Charaka', 'Sushruta', 'Kanada', 'Pingala', 'Brahmagupta', 'Madhava', 'Sangama', 'Triveni', 'Prayag', 'Indraprastha',
  'Hampi', 'Kishkindha', 'Ajanta', 'Ellora', 'Konark', 'Khajuraho', 'Sanchi', 'Nalanda', 'Takshila', 'Vikramshila',
  'Amaravati', 'Dhanyakataka', 'Kanchi', 'Madurapuri', 'Tamraparni', 'Kollidam', 'Bhavani', 'Amravati', 'Noyyal', 'Siruvani',
  'Kodachadri', 'Kudremukh', 'Bhadra', 'Hemavati', 'Shalmala', 'Netravati', 'Periyar', 'Bharathapuzha', 'Pamba', 'Chaliyar',
  'Indravati', 'Wainganga', 'Pench', 'Purna', 'Bhima', 'Koyna', 'Panchganga', 'Mandakini', 'Alaknanda', 'Bhagirathi',
  'Sutlej', 'Beas', 'Ravi', 'Chenab', 'Jhelum', 'Ghaggar', 'Luni', 'Banas', 'Mahi', 'Sabarmati', 'Barak', 'Manas',
  'Dhansiri', 'Kopili', 'Umiam', 'Gumti', 'Loktak', 'Dzukou', 'Tawang', 'Siang', 'Subansiri',
];

export const PREFIXES = ['', '', '', '', 'Sri ', 'Shri ', 'Sree ', 'Saint ', 'Rashtriya ', 'Navodaya ', 'Swami ', 'Mahatma '];

export const SECOND = ['', '', '', '', '', 'Vidya ', 'Gyan ', 'Jnana ', 'Bharati ', 'Valley ', 'Sagar ', 'Deepa ', 'Prabha '];

export const PATTERNS: Record<InstitutionType, string[]> = {
  Engineering: [
    '{n} College of Engineering', '{n} Institute of Technology', '{n} Engineering College',
    '{n} Institute of Engineering and Technology', '{n} College of Engineering and Technology', '{n} School of Engineering',
  ],
  Management: ['{n} Institute of Management Studies', '{n} School of Business Management', '{n} Institute of Management'],
  Polytechnic: ['{n} Polytechnic', '{n} Polytechnic College', '{n} Institute of Technical Education'],
  Pharmacy: ['{n} College of Pharmacy', '{n} Institute of Pharmacy'],
  Architecture: ['{n} School of Architecture', '{n} College of Architecture'],
  MCA: ['{n} Institute of Computer Applications', '{n} College of Computer Applications'],
};

export const TYPE_WEIGHTS: [InstitutionType, number][] = [
  ['Engineering', 50], ['Polytechnic', 18], ['Management', 14], ['Pharmacy', 9], ['MCA', 5], ['Architecture', 4],
];

/** Look-alike pair transforms: [nameA pattern, nameB pattern]. Both live in the same city. */
export const LOOKALIKE_PATTERNS: [string, string][] = [
  ['{n} College of Engineering', '{n} Engineering College'],
  ['{n} Institute of Technology', '{n} Institute of Science and Technology'],
  ['{n} Polytechnic', '{n} Polytechnic College'],
  ['{n} Institute of Management Studies', '{n} Institute of Management'],
  ['{n} College of Pharmacy', '{n} Institute of Pharmacy'],
  ['{n} Institute of Engineering and Technology', '{n} College of Engineering and Technology'],
];

/** Hero names that random generation must not collide with. */
export const RESERVED = ['Venkatesa', 'Venkatesh', 'Venkateswara'];
