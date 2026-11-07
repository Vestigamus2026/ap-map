#!/bin/sh
# Richtet die Karte „MeErWissen“ ein: Zone 1 Saalekreis, Zone 2 Saalekreis + Halle, Start in Halle.
# Aufruf: sh archive/meerwissen.sh [Einstellungsdatei]   (ohne Angabe: public/config.json)
set -e
DATEI="${1:-public/config.json}"

npm run zone -- zone3 delete --datei "$DATEI"
npm run zone -- zone2 delete --datei "$DATEI"

npm run zone -- zone1 62473 --datei "$DATEI"
npm run zone -- zone2 62473 62638 --datei "$DATEI"

npm run mapname -- "MeErWissen" --datei "$DATEI"
npm run home -- "Delitzscher Str. 53, Halle (Saale)" --umkreis 50 --datei "$DATEI"

npm run color -- colors --fill1 "gray, 10%" --border1 "gray" --width1 "4" --datei "$DATEI"
npm run color -- printColors --fill1 "transparent" --border1 "gray" --width1 "6" --datei "$DATEI"

npm run zone -- zone1 62473 --datei "$DATEI"
npm run zone -- zone2 62473 62638 --datei "$DATEI"
