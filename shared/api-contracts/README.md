# Shared API Contracts

This folder stores contracts that the React frontend and Express backend agree on.
The Python service mirrors these payloads through its own Pydantic schemas.

Recommended future direction:

- move response contracts into a versioned OpenAPI document
- generate OpenAPI-backed clients for the frontend
- generate backend validators from the same schema source
