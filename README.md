# APIB0020 — Events & Ticketing Platform

Course: API Best Practices | Section: — | Instructor: —

## Team Details

| # | Name              | Roll No      | GitHub ID     | Email                          |
|---|-------------------|--------------|---------------|--------------------------------|
| 1 | Prajwal Suvarna   | ROLLNO001    | prpoojary     | prajwal.suvarna@sap.com        |
| 2 | Lathish Kumar     | 2024SL70023  | Lathish-Kumar2 | lathishk910@gmail.com         |
| 3 | Team Member 3     | ROLLNO003    | gh-handle-3   | member3@example.com            |

- Team ID: `APIB0020` (must equal the repository name and `team.json.team_id`)
- Chosen Approach: `A` — REST-First + GraphQL Layer

## Quick start

```bash
git clone https://github.com/SAP2024-4Y/APIB0020
cd APIB0020
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
```

## GraphQL IDE

Open `http://localhost:8080/graphql` in your browser. A sample query:

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
```

## Run tests locally

```bash
npm install
npm test
```

## API overview

| Pattern   | REST endpoint                      | GraphQL field       |
|-----------|------------------------------------|---------------------|
| List      | `GET /api/v1/events`               | `Query.events`      |
| Detail    | `GET /api/v1/events/:id`           | `Query.event`       |
| Map       | `GET /api/v1/events/nearby`        | `Query.eventsNearby`|
| Calendar  | `GET /api/v1/bookings/slots`       | `Query.availableSlots` |
| Auth      | `POST /api/v1/auth/token`          | —                   |
