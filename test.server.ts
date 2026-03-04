import { rugplaySDK } from "./src/index.server";
import { ServerAuth } from "./src/server/ServerAuth";

ServerAuth.init({
    sessionData:
        "eyJzZXNzaW9uIjp7InNlc3Npb24iOnsiZXhwaXJlc0F0IjoiMjAyNi0wMy0wN1QxODo1Nzo1My4yMDNaIiwidG9rZW4iOiJTTzdWV0FESEtFbEJEcE1EdVE3TU5XR0I5eGoxMWNlciIsImNyZWF0ZWRBdCI6IjIwMjYtMDItMjhUMTg6NTc6NTMuMjAzWiIsInVwZGF0ZWRBdCI6IjIwMjYtMDItMjhUMTg6NTc6NTMuMjAzWiIsImlwQWRkcmVzcyI6IjE0NS4yMjQuNjcuMjUiLCJ1c2VyQWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0OyBydjoxNDcuMCkgR2Vja28vMjAxMDAxMDEgRmlyZWZveC8xNDcuMCIsInVzZXJJZCI6IjMwMCIsImlkIjoiMTMyMTM2In0sInVzZXIiOnsibmFtZSI6Ikl0c1RoYXRPbmVKYWNrIiwiZW1haWwiOiJzdHJheXdvbGYwMDBAZ21haWwuY29tIiwiZW1haWxWZXJpZmllZCI6dHJ1ZSwiaW1hZ2UiOiJhdmF0YXJzLzEwODA1OTgyNjU1NTkwNTIxNDY1OC5wbmciLCJjcmVhdGVkQXQiOiIyMDI1LTA1LTMwVDE2OjA0OjUyLjkwNVoiLCJ1cGRhdGVkQXQiOiIyMDI2LTAyLTI4VDE4OjM3OjA3LjAxMloiLCJ1c2VybmFtZSI6Iml0b2oiLCJpc0FkbWluIjpmYWxzZSwiaXNCYW5uZWQiOmZhbHNlLCJiYW5SZWFzb24iOiIiLCJiYXNlQ3VycmVuY3lCYWxhbmNlIjoiNDkzOTM4LjExNDEwNzM4IiwiYmlvIjoiSGFpIVxyXG5odHRwczovL2l0b2ouZGV2XHJcblxyXG5SZXN0IGluIHBlYWNlIEJMQywgYW5kIEZlZGVyYWxSZXNlcnZlLCBhbmQgdGhlIG90aGVyIGNvaW5zLi4uXHJcblJQLTU3M0E4NUI4Iiwidm9sdW1lTWFzdGVyIjoiMC43MCIsInZvbHVtZU11dGVkIjpmYWxzZSwiaWQiOiIzMDAifX0sImV4cGlyZXNBdCI6MTc3MjMwNTM3MzIwNywic2lnbmF0dXJlIjoiM3M1S0k3OXpoXzNIMmtmcmRkakF5SzNySTJ1S3E0VDFMY2hZNVdQZXlfOCJ9",
    sessionToken: decodeURIComponent(
        "SO7VWADHKElBDpMDuQ7MNWGB9xj11cer.qWjBNJTfK4wdyJuraV3KaWrHHVPmISgOeYSXwHYrLpo%3D",
    ),
    cfClearance:
        "qz_AYuJhgaQkcCxWe9Yr8nJrL5RlxpZEIe5dWgbCdAU-1772305985-1.2.1.1-LPX0Rlribz.EZxse4LfJVkaOa6d1gIOeF.ajVcB8MiqS53xogU_sKlLJQDqaJxbQWC8nHbsToQKfGgfTdA9byo.K5F.le0kWXZ0ppEdTKzTfaOr1DoF1RjEEL.gtTL7m1oC1mNGBKaMFAZDdcjW9KnY.lgQTvF5GdefNewLVsRnKG0oAHgC2YUSzfQj1_jFyed8GE06PjKFUIYBgO8SWoAYgU3oyL0JXUU8dWLxvvYg",
});

if (ServerAuth.isExpired()) {
    console.error("Session expired.");
    process.exit(1);
}

if (!(await ServerAuth.validate())) {
    console.error("Session invalid.");
    process.exit(1);
}

console.log("Session valid, expires:", ServerAuth.getExpiry());

const me = await rugplaySDK.User.me();
console.log("Logged in as:", me?.username);

await rugplaySDK.Chat.connect();
console.log("Connected to messaging services!");

const general = rugplaySDK.Channel.general();
general.sendMessage(
    "Hello World! This message was sent using the RugplaySDK Node.js/Bun library!",
);
