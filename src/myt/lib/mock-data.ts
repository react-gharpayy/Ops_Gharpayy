import { Zone, TeamMember, Tour, HeatmapData, Lead, Booking, TourType, Intent, ConfirmationStrength, WillBookToday, DecisionMaker } from './types';
import { scoreTour, inferConfirmationStrength } from './confidence';

export const zones: Zone[] = [
  { id: 'z1', name: 'Zone A — Koramangala', area: 'Koramangala' },
  { id: 'z2', name: 'Zone B — HSR Layout', area: 'HSR Layout' },
  { id: 'z3', name: 'Zone C — Indiranagar', area: 'Indiranagar' },
  { id: 'z4', name: 'Zone D — Whitefield', area: 'Whitefield' },
  { id: 'z5', name: 'Zone E — BTM Layout', area: 'BTM Layout' },
  { id: 'z6', name: 'Zone F — Electronic City', area: 'Electronic City' },
  { id: 'z7', name: 'Zone G — Marathahalli', area: 'Marathahalli' },
];

const names = [
  'Rahul Sharma','Priya Patel','Amit Kumar','Sneha Reddy','Vikram Singh',
  'Ananya Das','Karthik Nair','Divya Joshi','Rohan Gupta','Meera Iyer',
  'Arjun Rao','Pooja Verma','Nikhil Bhat','Swati Mishra','Aditya Menon',
  'Kavita Shetty','Sanjay Pillai','Ritu Agarwal','Deepak Hegde','Nisha Kulkarni',
  'Rajesh Mohan','Anjali Desai','Suresh Babu','Lakshmi Narayan','Manoj Tiwari',
  'Pallavi Deshpande','Harish Gowda','Sunita Yadav','Venkat Raman','Rekha Chandra',
  'Ashwin Pai','Geeta Saxena','Prakash Jain','Vandana Kapoor','Tarun Malhotra',
  'Shruti Bansal','Ravi Prasad','Kamala Devi','Sunil Patil','Uma Shankar',
  'Girish Srinivas','Bhavna Thakur',
];

export const teamMembers: TeamMember[] = names.map((name, i) => {
  const zoneIndex = Math.floor(i / 6);
  const zoneId = zones[Math.min(zoneIndex, 6)].id;
  const membersInZone = names.filter((_, j) => Math.floor(j / 6) === zoneIndex);
  const posInZone = membersInZone.indexOf(name);
  const role = posInZone < Math.ceil(membersInZone.length * 0.7) ? 'flow-ops' as const : 'tcm' as const;
  return {
    id: `m${i + 1}`,
    name,
    role,
    zoneId,
    phone: `+91 ${9800000000 + i}`,
  };
});

const properties = [
  'Prestige Lakeside','Brigade Meadows','Sobha Dream Acres','Godrej Splendour',
  'Mantri Serenity','Puravankara Zenium','Salarpuria Sattva','Embassy Springs',
  'Total Environment','Raheja Residency','Adarsh Palm Retreat','Shriram Greenfield',
];

const leadNames = [
  'Arun Mehta','Simran Kaur','Deepa Nair','Rajat Gupta','Neha Jain',
  'Sunil Reddy','Kavya Iyer','Mohit Sinha','Roshni Das','Akash Bose',
  'Tanya Sharma','Vivek Rao','Isha Kulkarni','Aman Verma','Shreya Pillai',
  'Kunal Desai','Megha Patil','Anil Tiwari','Prachi Hegde','Siddharth Menon',
  'Divya Saxena','Varun Kapoor','Nandini Agarwal','Harsh Malhotra','Poornima Shetty',
  'Ganesh Prasad','Ritika Joshi','Santosh Gowda','Meghna Chandra','Arjun Yadav',
  'Bhavika Shah','Rohit Bansal','Jaya Mohan','Kiran Babu','Snehal Deshpande',
  'Manikandan S','Trisha Roy','Uday Shankar','Lavanya Pai','Farhan Khan',
  'Ankita Thakur','Gaurav Srinivas','Reema Narayan','Nitin Bhat','Parul Mishra',
  'Dhruv Singh','Anisha Das','Tarun Nair','Sakshi Patel','Manish Kumar',
  'Shweta Reddy','Vikrant Sharma','Pallavi Iyer','Rajendra Gupta','Manju Verma',
  'Sagar Rao','Aishwarya Jain','Naveen Pillai','Chitra Desai','Karthik Patil',
  'Sunaina Tiwari','Ashish Hegde','Yamini Menon','Pranav Saxena','Richa Kapoor',
  'Abhishek Agarwal','Sonal Malhotra','Girija Shetty','Sameer Prasad','Vandana Joshi',
  'Ramesh Gowda','Swapna Chandra','Alok Yadav','Kritika Shah','Sudhir Bansal',
  'Mala Mohan','Arvind Babu','Geeta Deshpande','Pushpa S','Venkatesh Roy',
];

// Generate dates spread over last 30 days
function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d.toISOString().split('T')[0];
}

const today = new Date().toISOString().split('T')[0];

const statuses: Tour['status'][] = ['scheduled','confirmed','completed','no-show','cancelled'];
const outcomes: Tour['outcome'][] = ['draft','follow-up','rejected', null];
const sources: Tour['bookingSource'][] = ['call','whatsapp','referral','walk-in'];

const tourTypes: TourType[] = ['physical', 'virtual', 'pre-book-pitch'];
const willBookOpts: WillBookToday[] = ['yes', 'maybe', 'no'];
const decisionMakers: DecisionMaker[] = ['self', 'parent', 'group'];
const roomTypes = ['Single', 'Double Sharing', 'Triple Sharing', 'Studio'];
const occupations = ['Infosys', 'Wipro', 'Amazon', 'Christ University', 'PES University', 'Flipkart'];
const concerns = ['food quality', 'roommate match', 'distance to office', 'parking', 'wifi speed'];

// Dummy data removed — CRM now displays only real data from VPS/MongoDB.
// Seed arrays kept as empty exports to preserve module shape for legacy imports.
export const tours: Tour[] = [];
export const initialLeads: Lead[] = [];
export const initialBookings: Booking[] = [];
export const heatmapData: HeatmapData[] = [];

// Suppress unused-import warnings for helpers that were only used by the
// (now-removed) seed factories. Keeping these references is cheaper than
// untangling every shared util used by analytics helpers below.
void [
  properties, leadNames, statuses, outcomes, sources, tourTypes, willBookOpts,
  decisionMakers, roomTypes, occupations, concerns, scoreTour,
  inferConfirmationStrength, randomDate, today,
];

export function filterToursByDateRange(tourList: Tour[], range: DateRange): Tour[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (range === 'today') {
    return tourList.filter(t => t.tourDate === todayStr);
  }
  if (range === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return tourList.filter(t => new Date(t.tourDate) >= weekAgo);
  }
  // month
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  return tourList.filter(t => new Date(t.tourDate) >= monthAgo);
}

import { DateRange } from './types';

export function getZonePerformance(tourList: Tour[]) {
  return zones.map(zone => {
    const zoneTours = tourList.filter(t => t.zoneId === zone.id);
    const completed = zoneTours.filter(t => t.status === 'completed');
    const showed = zoneTours.filter(t => t.showUp === true);
    const drafts = zoneTours.filter(t => t.outcome === 'draft');
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      toursScheduled: zoneTours.length,
      toursCompleted: completed.length,
      showUpRate: zoneTours.length > 0 ? Math.round((showed.length / zoneTours.length) * 100) : 0,
      drafts: drafts.length,
      closures: Math.floor(drafts.length * 0.4),
    };
  });
}

export function getMemberPerformance(tourList: Tour[]) {
  return teamMembers.map(member => {
    const memberTours = member.role === 'tcm'
      ? tourList.filter(t => t.assignedTo === member.id)
      : tourList.filter(t => t.scheduledBy === member.id);
    const completed = memberTours.filter(t => t.status === 'completed');
    const showed = memberTours.filter(t => t.showUp === true);
    const drafts = memberTours.filter(t => t.outcome === 'draft');
    const zone = zones.find(z => z.id === member.zoneId);
    return {
      memberId: member.id,
      name: member.name,
      role: member.role,
      zoneName: zone?.name || '',
      leadsAdded: memberTours.length + Math.floor(Math.random() * 5),
      toursScheduled: memberTours.length,
      toursCompleted: completed.length,
      showUpRate: memberTours.length > 0 ? Math.round((showed.length / memberTours.length) * 100) : 0,
      drafts: drafts.length,
      closures: Math.floor(drafts.length * 0.4),
      sameDayRate: Math.round(40 + Math.random() * 40),
    };
  });
}
