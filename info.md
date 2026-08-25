| Phase     | Work                                     | Status                     |
| --------- | ---------------------------------------- | -------------------------- |
| **1**     | Project folder + development environment | ✅ **COMPLETED**            |
| **2**     | PostgreSQL + PostGIS                     | ✅ **COMPLETED**            |
| **3**     | FastAPI basic backend                    | ✅ **COMPLETED**            |
| **4**     | SQLAlchemy + database models             | ✅ **COMPLETED**            |
| **5**     | Alembic migrations                       | ✅ **COMPLETED**            |
| **6**     | Master Meter CSV upload                  | ✅ **COMPLETED**            |
| **7**     | CSV validation + database storage        | ✅ **COMPLETED**            |
| **8**     | PostGIS meter locations                  | ✅ **COMPLETED**            |
| **9**     | Pending Consumer CSV                     | ✅ **COMPLETED**            |
| **10**    | Meter ID matching                        | ✅ **COMPLETED**            |
| **11**    | Officer + Assignment + RBAC              | ✅ **COMPLETED**            |
| **12**    | Next.js frontend                         | ✅ **COMPLETED**            |
| **13**    | Login + Dashboards (Super, Zonal, Area, Field Officer) | ✅ **COMPLETED**            |
| **14**    | GIS Map (Vector & Satellite, Role-scoped)              | ✅ **COMPLETED**            |
| **15**    | GPS / Device Location Permission                       | ✅ **COMPLETED**            |
| **16**    | Search (Ward-scoped & All Dashboards)                  | ✅ **COMPLETED**            |
| **17**    | Payment / Days Overdue Priority Filters                | ✅ **COMPLETED**            |
| **18**    | Nearby assigned consumers                | ✅ **COMPLETED**            |
| **19**    | Route generation                         | ✅ **COMPLETED**            |
| **20**    | Recovery/status update                   | ✅ **COMPLETED**            |
| **21**    | Reports/dashboard                        | ✅ **COMPLETED**            |
| **22**    | Redis                                    | ⏳ **NOT STARTED**          |
| **23**    | Background Worker                        | ⏳ **NOT STARTED**          |
| **24**    | Object Storage                           | ⏳ **NOT STARTED**          |
| **25**    | Nginx                                    | ⏳ **NOT STARTED**          |
| **26**    | Monitoring / Logging                     | ⏳ **NOT STARTED**          |
| **27**    | HTTPS                                    | ⏳ **NOT STARTED**          |
| **28**    | Docker                                   | ⏳ **NOT STARTED**          |
| **29**    | CI/CD                                    | ⏳ **NOT STARTED**          |
| **Final** | Complete system testing                  | ⏳ **NOT STARTED**          |
12.5 — Area Admin Dashboard

The Area Admin is responsible for one particular Area inside a Zone.

1. Area Admin login

When an Area Admin logs in, the system identifies:

Officer identity
Role = AREA_ADMIN
zone_id
area_id

Example:

Name: Amit Sharma
Role: AREA_ADMIN
Zone: Nagpur
Area: Nagpur East

The Area Admin should only see data belonging to Nagpur East.

2. Area Admin dashboard

The dashboard should show the overall information of that Area:

Area name and code
Number of Field Areas
Number of Master Meters
Number of Consumers
Number of Field Officers
Pending/operational information relevant to that Area

It should not show meters or consumers from other Areas of Nagpur.

3. Field Area information

The Area Admin should be able to see all Field Areas under their Area.

For example:

Nagpur East


Field Area 1
Field Area 2
Field Area 3
Field Area 4

For each Field Area, the Area Admin can see relevant operational information such as:

Number of meters
Number of consumers
Assigned Field Officers
Work/recovery status
4. Master Meter visibility

If a meter belongs to:

Zone = Nagpur
Area = Nagpur East
Field Area = FA-02

the Area Admin of Nagpur East can see it.

A meter belonging to:

Zone = Nagpur
Area = Nagpur West

must not be visible to that Area Admin.

5. Area Admin manages Field Officers

This is an important responsibility.

The Area Admin should be able to:

View Field Officers under the Area
Create/manage Field Officers
Assign a Field Officer to a Field Area
Change Field Area assignment when authorized
View the operational work of those Field Officers

For example:

Area Admin
Nagpur East


Field Officer 1 → Field Area 01
Field Officer 2 → Field Area 02
Field Officer 3 → Field Area 03
6. Area Admin → Field Officer connection

When creating a Field Officer, the system should automatically establish:

zone_id
area_id
field_area_id

For example:

Officer: Suresh
Role: FIELD_OFFICER
Zone: Nagpur
Area: Nagpur East
Field Area: FA-02

This assignment determines what data the Field Officer can access.

12.6 — Field Officer Dashboard

The Field Officer is the lowest operational level and works with the actual field data.

The Field Officer should not see the complete Zone or complete Area.

1. Field Officer login

When a Field Officer logs in, the system identifies:

Officer identity
Role = FIELD_OFFICER
zone_id
area_id
field_area_id

Example:

Name: Suresh Patil
Role: FIELD_OFFICER
Zone: Nagpur
Area: Nagpur East
Field Area: FA-02

His data scope is therefore Field Area FA-02.

2. Field Officer dashboard

The dashboard should show:

Officer name
Assigned Zone
Assigned Area
Assigned Field Area
Number of assigned meters
Number of assigned consumers
Assigned/pending work
Recovery/status information
Relevant field activities
3. Meter visibility

If the Field Officer is assigned to:

Nagpur
→ Nagpur East
→ Field Area FA-02

he should see only meters belonging to FA-02.

For example:

Meter 1001
Meter 1002
Meter 1003
Meter 1004

He should not see meters belonging to:

FA-01
FA-03
Nagpur West
Nagpur Central
4. Consumer visibility

Consumers associated with the Field Officer's assigned field area should be visible to him.

For example:

FA-02
    ↓
Meters
    ↓
Consumers

The Field Officer can then work with those consumers for the later phases such as:

Search
GPS location
Nearby consumers
Route generation
Recovery
Status update
5. Field Officer operational work

The Field Officer is primarily an execution-level user.

Later phases will use this dashboard for:

Finding assigned consumers
Viewing meter/consumer location
Using GPS
Finding nearby assigned consumers
Generating routes
Updating consumer/recovery status
Recording field activity

So the Field Officer dashboard should be simple and operational rather than administrative.

12.5 and 12.6 relationship

The important relationship is:

ADMIN manages the Zone.

AREA_ADMIN manages one Area inside that Zone.

FIELD_OFFICER works inside a Field Area belonging to that Area.

Therefore:

ADMIN
→ entire Zone


AREA_ADMIN
→ one Area within the Zone


FIELD_OFFICER
→ one Field Area within that Area
What we have to do in Super Admin

The Super Admin is the highest-level administrative account for the entire Maharashtra system. Its responsibility is mainly state-level administration and control, while Zonal Admins handle individual zones.

1. Super Admin Login

We need one dedicated Super Admin account with:

Email/login
Password
Role = SUPER_ADMIN
Active/inactive status

After successful login, the user is redirected to the Super Admin Dashboard.

The Super Admin should not be treated as a normal Zonal Admin.

2. Maharashtra Overall Dashboard

After login, the dashboard should represent the entire Maharashtra state.

It should show:

Maharashtra overall map
Total Zones
Total Zonal Admins
Total Areas
Total Field Areas
Total Master Meters

Overall operational statistics

The data should come from the real backend/database rather than fixed numbers.

3. Maharashtra Map

The main map should represent Maharashtra.

The Super Admin should be able to see the different zones geographically.

For example:

Nagpur
Pune
Mumbai
Nashik
Kolhapur
Aurangabad
etc.

Clicking/selecting a zone should allow the Super Admin to inspect that zone's information.

4. Zone Search

There should be a search/filter such as:

Search Zone

The Super Admin can search:

Nagpur
Pune
Mumbai
Nashik
etc.

When Nagpur is selected, the dashboard should show Nagpur-specific information.

For example:

Nagpur Zonal Admin
Number of Areas
Number of Field Areas
Number of Master Meters
Number of Consumers
Other operational statistics

This does not change the Super Admin's access. It is simply a way to filter the Maharashtra-level information.

5. Zonal Admin Count

The Super Admin should see the number of Zonal Admins currently created.

Example:

Total Zonal Admins: 6

The Super Admin should also be able to see which administrator is assigned to which zone.

Example:

Nagpur       → Nagpur Admin
Pune         → Pune Admin
Mumbai       → Mumbai Admin
Nashik       → Nashik Admin
6. Create Zonal Admin

This is one of the main functions already being developed.

The Super Admin should have:

Create Zonal Admin

The form should collect:

Officer Code
Officer Name
Email
Phone
Zone
Password workflow as decided later

For the zone, the UI should show the zone name and code, not ask the administrator to remember a numeric database ID.

For example:

Nagpur (NGP-04)
Pune (PUN-01)
Mumbai (MUM-01)

When the Zonal Admin is created, the backend stores the corresponding zone_id.

7. Zonal Admin → Zone Connection

This is very important.

When we create:

Nagpur Admin
Zone = Nagpur

the database should establish:

officer.role = ADMIN
officer.zone_id = Nagpur's ID

From that point, the system knows that this administrator belongs to Nagpur.

Therefore, when that person logs in, the Zonal Admin dashboard automatically loads Nagpur data.

The Super Admin does not have to manually configure the dashboard again.

8. Master Data

The Super Admin is also responsible for the overall master-data upload/management process as currently planned.

The uploaded master-meter data should contain the required information such as:

Meter ID
Customer ID
Customer Name
Latitude
Longitude
Geographic assignment where applicable

The backend already has the master-meter import functionality.

The important next step is to ensure that uploaded meter data is correctly connected to:

Zone
Area
Field Area

Once that geographical relationship exists, the same meter can automatically appear in the correct administrator's dashboard.

9. Master Meter Visibility

The Super Admin should be able to see all Maharashtra master meters.

If there are, for example:

Maharashtra
Total Master Meters = 40,000

the Super Admin can see the overall number.

If the Super Admin selects Nagpur:

Nagpur
Master Meters = 4,004

only Nagpur's information is displayed in the filtered view.

The Zonal Admin, however, would automatically see only those 4,004 Nagpur meters.

10. Super Admin should NOT be restricted by zone

This is the major difference between Super Admin and Zonal Admin.

Super Admin:

Maharashtra-wide access
Can see every Zone
Can see every Zonal Admin
Can view overall master data
Can search/filter by Zone
Can create Zonal Admins

Zonal Admin:

One assigned Zone
Cannot see other Zones
Manages information within that Zone
11. Area Admin creation comes later

The Super Admin does not necessarily need to create Area Admins if we define the responsibility hierarchy as:

Super Admin → creates/manages Zonal Admin
Zonal Admin → creates/manages Area Admin
Area Admin → manages Field Officers



Phase 15 — GPS / Location Permission

Purpose: Obtain the Field Officer's current location.

Field Officer opens the application.
System requests permission to access device/browser location.
Officer selects Allow Location.
If permission is denied, the system should clearly show that location access is required for GPS-based features.
Once permission is granted, the system obtains:
Current latitude
Current longitude
The location is associated with the logged-in Field Officer.
This location is then used by:
Phase 18: Nearby assigned consumers
Phase 19: Route generation
Phase 16 — Search

Purpose: Allow the Field Officer to find a particular assigned consumer/meter.

The officer can search using:

Meter ID
Customer ID
Customer Name
Other permitted search criteria

The important restriction is:

Field Officer → only their assigned field-area data

They cannot search the entire Maharashtra database.

Example

Officer searches:

Meter ID = MTR001

System checks:

MTR001 → Field Area 1 → Officer's assigned area

If it belongs to the officer, its details are displayed.

Relationship

Phase 16 identifies which consumer/meter the officer is interested in.

Phase 17 — Payment / Days Filters

Purpose: Identify which of the Field Officer's assigned consumers need attention first.

This phase is specifically for the Field Officer operational workflow.

The officer can filter assigned consumers based on things such as:

Payment pending
Outstanding amount
Days overdue
Payment status
Recovery priority

The system first restricts the data:

Field Officer → Assigned Field Area → Assigned Consumers

Then applies the filters.

Example

Officer has 100 assigned consumers.

After filtering:

30 have pending payments
15 are overdue by more than 30 days
8 have higher outstanding amounts

The officer can focus on those consumers.

Relationship

Phase 17 converts the large assigned-consumer list into a priority list.

That priority list becomes useful for Phase 18

Phase 18 — Nearby Assigned Consumers
Use the GPS location obtained in Phase 15.
Display the Field Officer's current position on the map.
Show only assigned consumers/meters nearby.
Calculate the distance between the officer and each consumer.
Display distance such as:
500 m
1.2 km
3.5 km
Consumers can be shown as map markers.
Selecting a marker shows consumer/meter details.
Provide a map experience similar to Google Maps for viewing location and distance.
Phase 19 — Route Generation

This phase provides the Google-Maps-like navigation/route experience.

Officer selects one or multiple assigned consumers.
System calculates the route from the current GPS location.
Show the route visually on the map.
Display:
Distance
Estimated travel time
Consumer/stop sequence
Route between locations
Allow the officer to see the order of visits.
The route should be based only on authorized/assigned consumers.
Phase 19 — Route Generation

Purpose: Decide the order in which the Field Officer should visit consumers.

Now the system has information from previous phases:

Current officer location — Phase 15
Selected/searched consumers — Phase 16
Priority consumers — Phase 17
Nearby consumers — Phase 18

Using these locations, the system generates a practical visit sequence.

Example

Instead of:

Officer → Consumer A → Consumer D → Consumer B → Consumer C

the system may determine:

Officer → Consumer B → Consumer A → Consumer C → Consumer D

based on geographical proximity/route efficiency.

The exact routing algorithm can be decided when we implement Phase 19.

Relationship

Phase 19 takes the selected/priority/nearby consumers and turns them into an ordered field-visit plan.
Phase 20 — Recovery / Status Update

Purpose: Record what happened after the Field Officer visits a consumer.

After reaching a consumer, the officer performs the required field activity and updates the status.

Possible statuses can include:

Payment recovered
Payment not recovered
Consumer contacted
Consumer unavailable
Meter/problem identified
Other defined field status

The system records the update against the correct consumer/assignment.

Example

Before visit:

Customer → ₹5,000 outstanding → Pending

After field visit:

₹5,000 recovered → Payment Recovered

The database is then updated.

Phase 21 — Field Officer Reports / Dashboard

The Field Officer will see only data related to their assigned consumers/field area:

Recovery completed
Recovery pending
Number of consumers visited
Number of consumers not visited
Outstanding amount
Payment recovery
Field Officer's own performance
Daily report
Monthly report
Access scope

Field Officer → Own assigned consumers → Own field activity → Own reports

The following are held for later:

❌ Super Admin → Maharashtra overall
❌ Zonal Admin → Their zone
❌ Area Admin → Their area.