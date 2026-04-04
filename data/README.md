# AssistNow Offline Cache

Place `assistnow.ubx` in this folder and run:

```
pio run -t uploadfs
```

The firmware will inject this file into the GPS module at boot,
even without WiFi or valid credentials.

## How to get assistnow.ubx

1. Go to https://www.u-blox.com/en/assistnow-service-evaluation-token
2. Request an evaluation token
3. Download data:
   ```
   curl -o assistnow.ubx "https://online-live1.services.u-blox.com/GetOnlineData.ashx?token=YOUR_TOKEN&gnss=gps,gal&datatype=eph,alm,aux"
   ```
4. Place the file here and upload to ESP32 filesystem

## Notes

- The file must start with UBX sync bytes (0xB5 0x62)
- Data is valid for ~2-4 hours for online, ~days for offline
- File size should be several KB (if only 60 bytes, it's an error page)
