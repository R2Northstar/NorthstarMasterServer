![Initiation diagram](https://www.planttext.com/api/plantuml/png/bLHDZzCm4BtxLmnxW5Gh3Yot7D2Mgk93jAgQIfnTPzfOTSV1dkoIVyyaTTgqi20kYUDvyzxpp3XAFKRMWPkZKspP8InzuAhRWuMEZ04A34_o-aAMhMRhIQbNNE4HOUiQt0VTAlK6YXgDtRKW4QY5q1fRQ-883dSCx27OVSMvGXAP5kwM-3mmB-z0HvWQzk4Sdl-qaItj1yoYntpq3PKwj6gR5YdiC4Pbl7DeEeCHbiZFFXnkVE4JTeuoI-13YM6IgttmJPtEvc3cYRLXo3vlDgk9WfCfUFjXf9F36dyq61bYlnS5Tebss3ufXszo0l2xCmofL4blLUc8y0wcZTYI4vk-hf1znstXpG6vqnwf3-VE4rboyDLRwe53_1hx2Gc3PeHYFblFDxyXayyJPSSrgxIKaFPu3wlibFGF8rTPKsOyrWptBmcchkIWopAjbxx4_p2snbXBVr4qZ0z1sYqhkb15-MH_GCeMaxxWute_TFsbquYCUtksPIxXszptKBHagk39Hfq8dFSrDD8-1m6v2OGboCMHWji83zU5EsiCmsD9e6JmbD634sPKWNLF-oTiv-_l0gQH-X13gLc_G5y8In-N6ziwhql8j37I2BaahuUvlPc0bBeAtdJZthDtDEfHdl8N-GK0)

```uml
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
```
