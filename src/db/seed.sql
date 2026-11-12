-- Organizers
INSERT OR IGNORE INTO organizers VALUES
  ('org-1','Bangalore Tech Collective','btc@example.com','+91-9800000001','2025-01-01T00:00:00Z'),
  ('org-2','Indiranagar Music Society','ims@example.com','+91-9800000002','2025-01-02T00:00:00Z'),
  ('org-3','Koramangala Workshop Hub','kwh@example.com','+91-9800000003','2025-01-03T00:00:00Z'),
  ('org-4','Whitefield Sports Club','wsc@example.com','+91-9800000004','2025-01-04T00:00:00Z'),
  ('org-5','MG Road Events Co.','mge@example.com','+91-9800000005','2025-01-05T00:00:00Z');

-- Venues (Bengaluru neighbourhoods, real approximate coordinates)
INSERT OR IGNORE INTO venues VALUES
  ('venue-1','MLR Convention Centre','No.11, Brigade Road, Bengaluru','Bengaluru',77.6082,12.9716),
  ('venue-2','Hard Rock Cafe Indiranagar','12th Main, Indiranagar, Bengaluru','Bengaluru',77.6408,12.9784),
  ('venue-3','NIMHANS Convention Centre','Hosur Road, Bengaluru','Bengaluru',77.5989,12.9308),
  ('venue-4','Phoenix Marketcity','Whitefield Main Rd, Bengaluru','Bengaluru',77.7499,12.9969),
  ('venue-5','UB City Clubhouse','Vittal Mallya Road, Bengaluru','Bengaluru',77.5955,12.9719),
  ('venue-6','The Lalit Ashok Banquet','Kumara Krupa High Grounds, Bengaluru','Bengaluru',77.5870,12.9944),
  ('venue-7','Bowring Institute','St Marks Road, Bengaluru','Bengaluru',77.5965,12.9733),
  ('venue-8','Koramangala Indoor Stadium','Koramangala 4th Block, Bengaluru','Bengaluru',77.6277,12.9351),
  ('venue-9','JP Nagar Community Hall','JP Nagar 2nd Phase, Bengaluru','Bengaluru',77.5745,12.9082),
  ('venue-10','Manyata Tech Park Amphitheatre','Nagawara, Bengaluru','Bengaluru',77.6261,13.0456);

-- Events (25 seed events, spread across categories/statuses/prices/dates)
INSERT OR IGNORE INTO events VALUES
  ('evt-001','Bengaluru DevFest 2026','Annual Google Developer Festival with 50+ talks.','OPEN','TECH',999,'2026-12-05T04:30:00Z','2026-12-05T13:30:00Z',2000,340,'venue-1','org-1'),
  ('evt-002','Cloud & AI Summit','Deep dives into Kubernetes, LLMs and platform engineering.','UPCOMING','TECH',2499,'2026-12-20T04:00:00Z','2026-12-20T12:00:00Z',800,0,'venue-5','org-1'),
  ('evt-003','React India 2026','The largest React conference in South Asia.','OPEN','TECH',1499,'2026-11-28T04:30:00Z','2026-11-29T12:30:00Z',1200,980,'venue-3','org-1'),
  ('evt-004','Backyard Jazz Night','Smooth jazz under the stars at Indiranagar.','OPEN','MUSIC',799,'2026-11-22T13:00:00Z','2026-11-22T17:00:00Z',300,291,'venue-2','org-2'),
  ('evt-005','EDM Takeover Vol 3','All-night electronic dance music with Arjun Vagale.','SOLD_OUT','MUSIC',2999,'2026-12-13T17:00:00Z','2026-12-14T05:00:00Z',500,500,'venue-6','org-2'),
  ('evt-006','Carnatic Fusion Evening','Classical meets contemporary at UB City.','UPCOMING','MUSIC',499,'2026-12-27T13:30:00Z','2026-12-27T16:30:00Z',400,0,'venue-5','org-2'),
  ('evt-007','Figma to Prod Workshop','Hands-on UI/UX to production-ready design system workshop.','OPEN','WORKSHOP',1999,'2026-11-30T04:30:00Z','2026-11-30T10:30:00Z',60,45,'venue-7','org-3'),
  ('evt-008','Python for Data Scientists','Intensive 1-day bootcamp: pandas, sklearn, deployment.','UPCOMING','WORKSHOP',2999,'2026-12-07T04:00:00Z','2026-12-07T12:00:00Z',50,0,'venue-7','org-3'),
  ('evt-009','Public Speaking Masterclass','Overcome stage fright and structure powerful talks.','UPCOMING','WORKSHOP',1499,'2026-12-14T05:00:00Z','2026-12-14T09:00:00Z',40,0,'venue-9','org-3'),
  ('evt-010','IPL Watch Party – Final','Giant screen viewing party with live commentary.','OPEN','SPORTS',399,'2026-12-10T13:30:00Z','2026-12-10T18:00:00Z',600,520,'venue-8','org-4'),
  ('evt-011','5K Fun Run – MG Road','Charity run on traffic-free MG Road.','UPCOMING','SPORTS',299,'2026-12-21T02:30:00Z','2026-12-21T05:30:00Z',1000,0,'venue-1','org-4'),
  ('evt-012','Amateur Chess Tournament','FIDE-rated open rapid chess, all levels welcome.','OPEN','SPORTS',599,'2026-11-29T04:30:00Z','2026-11-29T12:30:00Z',200,88,'venue-7','org-4'),
  ('evt-013','Open Mic Comedy Night','10 comics, 1 stage, unlimited laughs.','OPEN','COMEDY',699,'2026-11-23T13:30:00Z','2026-11-23T16:30:00Z',150,135,'venue-2','org-5'),
  ('evt-014','Stand-up Specials: Live Recording','Headliners Biswa Kalyan Rath & Kanan Gill.','SOLD_OUT','COMEDY',2499,'2026-12-06T14:00:00Z','2026-12-06T17:00:00Z',400,400,'venue-5','org-5'),
  ('evt-015','Street Art Festival Bengaluru','Live mural creation across 3 blocks of Indiranagar.','UPCOMING','ART',0,'2026-12-28T04:30:00Z','2026-12-28T13:30:00Z',3000,0,'venue-2','org-5'),
  ('evt-016','Photography Masterclass','Portrait and street photography with Anurag Arora.','OPEN','WORKSHOP',3499,'2026-12-03T04:30:00Z','2026-12-03T11:30:00Z',30,22,'venue-7','org-3'),
  ('evt-017','Node.js Performance Workshop','Profiling, clustering, and tuning Node for production.','UPCOMING','TECH',1999,'2027-01-10T04:30:00Z','2027-01-10T10:30:00Z',80,0,'venue-10','org-1'),
  ('evt-018','Indie Music Night','Local bands compete for a record deal.','OPEN','MUSIC',499,'2026-12-01T14:00:00Z','2026-12-01T18:00:00Z',200,170,'venue-2','org-2'),
  ('evt-019','Yoga & Wellness Retreat','Full-day immersive wellness experience at Manyata.','UPCOMING','WORKSHOP',4999,'2027-01-15T03:30:00Z','2027-01-15T12:30:00Z',60,0,'venue-10','org-3'),
  ('evt-020','Table Tennis Invitational','Open doubles knockout tournament.','UPCOMING','SPORTS',799,'2026-12-17T04:30:00Z','2026-12-17T12:30:00Z',128,0,'venue-8','org-4'),
  ('evt-021','GenAI Hackathon 48H','Build with Gemini, Claude and open-source models.','OPEN','TECH',0,'2026-12-19T05:30:00Z','2026-12-21T05:30:00Z',200,155,'venue-4','org-1'),
  ('evt-022','Podcast Recording Live','Nikhil Kamath hosts The 1% Club live audience recording.','SOLD_OUT','COMEDY',1999,'2026-12-08T13:30:00Z','2026-12-08T15:30:00Z',250,250,'venue-5','org-5'),
  ('evt-023','Karnatic Percussion Workshop','Learn mridangam fundamentals from Patri Satish Kumar.','UPCOMING','MUSIC',3999,'2027-01-08T05:00:00Z','2027-01-08T09:00:00Z',30,0,'venue-9','org-2'),
  ('evt-024','AR/VR Developer Bootcamp','Hands-on Unity XR for mobile – bring your headset.','UPCOMING','TECH',2999,'2027-01-18T04:30:00Z','2027-01-18T12:30:00Z',40,0,'venue-4','org-1'),
  ('evt-025','Cancelled: New Year Gala','Event postponed to Q1 2027.','CANCELLED','MUSIC',1499,'2026-12-31T17:30:00Z','2027-01-01T03:30:00Z',500,0,'venue-6','org-2');
