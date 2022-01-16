@startuml
title Northstar Master Server Initiation

!theme bluegray

' Specify the participants left to right:
entity "New Server N" as Actor
entity "Existing Server M" as Boundary
boundary Serverless
collections Network
' Specify the events (in order):
group Initial Contact (HTTP)
  Actor -> Serverless: Request servers
  Serverless -> Actor: List of servers
end

group Phase 1 Authentication (WebSocket)
    Actor -> Boundary: serverRequestJoin
    Boundary -> Boundary: Generate SECRET
    Boundary -> Actor: serverJoinChallenge+ P(SECRET)
    Actor -> Boundary: serverJoinChallengeAttempt + SECRET
    Boundary -> Network: addNetworkNode
    Boundary -> Actor: serverJoinChallengeResponse + correct + networkNodes + token(M)
end
group Phase 2 Connection
  Actor -> Network: connection
end
group Phase 3 Synchronisation
  Boundary -> Network: Bunch of sync stuff i dont really understand
end 
@enduml