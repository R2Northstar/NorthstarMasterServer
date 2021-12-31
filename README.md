# Forked Northstar Master Server
> An alternate Master Server for [Northstar](https://github.com/R2Northstar/Northstar)

## Why?
This fork is built upon the [official Master Server](https://github.com/R2Northstar/NorthstarMasterServer), but maintains a number of important improvements.
* Type safety thanks to TypeScript
* More structured project layout
* High availability using Redis to sync multiple instances (WIP)
* Multiple storage backends (SQLite for dev/single instances, or PostgreSQL for high availability)
* Route Caching for commonly requested routes using Redis (WIP)
* Automatic Docker Images
