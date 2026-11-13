# APIBP0020 — Events & Ticketing Platform

Course: API Best Practices | Section: — | Instructor: —

## Team Details

| # | Name              | Roll No      | GitHub ID     | Email                          |
|---|-------------------|--------------|---------------|--------------------------------|
| 1 | Prajwal Suvarna   | 2024SL70009  | prpoojary     | prajwalpoojary256@gmail.com    |
| 2 | Lathish Kumar     | 2024SL70023  | Lathish-Kumar2 | lathishk910@gmail.com         |
| 3 | Mahadev Prasad M  | 2024SL70027  | Mady003 | mahadevprasadshetty2003@gmail.com    |
| 4 | Sunil Venkateshwaran | 2024SL70043 | Sunil0V2  | sunilvenkateshwaran@gmail.com  |

- Team ID: `APIBP0020` (must equal the repository name and `team.json.team_id`)
- Chosen Approach: `A` — REST-First + GraphQL Layer

## Quick start

```bash
git clone https://github.com/SAP2024-4Y/APIBP0020
cd APIBP0020
docker compose up
# Server:      http://localhost:8080
# REST docs:   http://localhost:8080/docs
# GraphQL IDE: http://localhost:8080/graphql
```

## Demo credentials

```
POST /api/v1/auth/token
{ "username": "demo", "password": "demo-password" }
```

Returns `{ "token": "<jwt>" }` — use as `Authorization: Bearer <token>`.

## Example REST call

```bash
# List OPEN TECH events sorted by price ascending, first page of 5
curl "http://localhost:8080/api/v1/events?status=OPEN&category=TECH&sort=price&order=asc&limit=5"

# Next page (paste next_cursor value from previous response)
curl "http://localhost:8080/api/v1/events?status=OPEN&category=TECH&sort=price&order=asc&limit=5&after=<cursor>"

# Map API — events within 10 km of Bengaluru centre
curl "http://localhost:8080/api/v1/events/map?latitude=12.975&longitude=77.606&radius_km=10"

# Calendar API — available slots in December 2026
curl "http://localhost:8080/api/v1/bookings/slots?starts_at=2026-12-01T00:00:00Z&ends_at=2026-12-31T23:59:59Z"
```

## GraphQL IDE

Open `http://localhost:8080/graphql` in your browser. Sample queries:

```graphql
query {
  events(status: OPEN, category: TECH, sort: price, order: asc, first: 5) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges {
      cursor
      node { id title price starts_at venue { name coordinates } }
    }
  }
}

query {
  eventsNearby(latitude: 12.975, longitude: 77.606, radius_km: 10) {
    id title distanceKm location { type coordinates }
  }
}

query {
  availableSlots(starts_at: "2026-12-01T00:00:00Z", ends_at: "2026-12-31T23:59:59Z") {
    id title starts_at ends_at
  }
}
```

## Run tests locally

```bash
npm install
npm test
```

## Run lint locally

```bash
npm run lint
```

## API overview

| Pattern   | REST endpoint                      | GraphQL field          |
|-----------|------------------------------------|------------------------|
| List      | `GET /api/v1/events`               | `Query.events`         |
| Detail    | `GET /api/v1/events/:id`           | `Query.event`          |
| Map       | `GET /api/v1/events/map`           | `Query.eventsNearby`   |
| Calendar  | `GET /api/v1/bookings/slots`       | `Query.availableSlots` |
| Auth      | `POST /api/v1/auth/token`          | —                      |
