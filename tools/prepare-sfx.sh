#!/bin/sh
# =========================================================================
# prepare-sfx.sh — macht aus den Rohdateien in assets/sortme/ die Sounds,
# die das Spiel laedt.
#
# Die Rohdateien sind Downloads von Sound-Seiten: Stereo, hohe Bitrate und
# zu 70-95 % Stille. Fuer ein Geraeusch, das dreissig Mal pro Sekunde
# ausgeloest wird, ist das in jeder Hinsicht falsch herum. Dieses Skript
# stellt vier Dinge her, auf die sich src/audio.ts verlaesst:
#
#   1. KEINE STILLE AM ANFANG. Ein One-Shot muss beim ersten Sample klingen,
#      sonst ist der Vorlauf als Latenz hoerbar — der Peg-Treffer kaeme nach
#      dem Aufprall.
#   2. MONO. Die Sounds werden im Spiel ueber einen StereoPanner nach der
#      x-Position der Kugel im Feld verteilt. Eine Stereo-Quelle wuerde diese
#      Ortung ueberschreiben und halbiert nebenbei nichts an Groesse.
#   3. GLEICHER SPITZENPEGEL. Alle Dateien laufen auf -1 dBFS. Damit ist die
#      Lautstaerke im Spiel eine reine Design-Entscheidung in SFX (audio.ts)
#      und nicht die Zufallssumme aus Aufnahmepegel und gewuenschter Rolle.
#   4. LAENGENDECKEL. Was laenger klingt als seine Rolle im Spiel dauert,
#      wird geschnitten und ausgeblendet.
#
# Aufruf:  sh tools/prepare-sfx.sh
# Braucht: ffmpeg im Pfad.
# =========================================================================
set -e

SRC="assets/sortme"
OUT="public/assets/sfx"
mkdir -p "$OUT"

command -v ffmpeg >/dev/null || { echo "ffmpeg fehlt"; exit 1; }

# id | Quelldatei (ohne .mp3) | Maximallaenge in s | Ausblende in s | Halbtoene
#
# Die Tonhoehe wird ueber die Abtastrate verschoben, aendert also auch die
# LAENGE — genau richtig fuer Gesten. `tube`, `panel` und `swipe` sind
# deshalb dieselbe Aufnahme: der Wisch beim Levelwechsel ist eine schnelle
# kleine Geste (+5 Halbtoene, kurz), das Aufziehen der Auswahl dieselbe
# Bewegung in gross (-4 Halbtoene, traege). Eine Aufnahme, drei Rollen.
TABLE="
peg1|creatorshome-sharp-pop-328170|0.25|0.05
peg2|universfield-bubble-pop-06-351337|0.25|0.05
peg3|dragon-studio-pop-402324|0.25|0.05
peg4|soundreality-pop-423717|0.25|0.05
peg5|soundreality-pop-sound-423716|0.25|0.05
peg6|dragon-studio-pop-402323|0.25|0.05
cover|u_a555j5miio-blip-120938|0.30|0.06
bumper|freesound_community-fast-collision-reverb-14611|0.55|0.12
spawn|freesound_community-clickselect2-92097|0.25|0.05
drain|soundreality-bubble-pop-424583|0.70|0.15
tube|biww-short-whoosh-swipe-sound-effect-561941|0.60|0.12|0
pulse|freesound_community-archi_sonar_03-108206|1.10|0.25
zap|biww-short-electric-zap-561890|0.40|0.08
ignite|freesound_community-match-ignite-no-strike-37252|0.70|0.15
buff|tithuh-powerup-success-523645|0.90|0.15
mark|soundshelfstudio-ui-target-locked-beep-535369|0.30|0.06
crack|creatorshome-sharp-pop-328170|0.30|0.06|-7
smash|freesound_community-fast-collision-reverb-14611|0.60|0.14|-6
buy|u_a555j5miio-blip-120938|0.26|0.06|-5
denied|dragon-studio-bubble-pop-406640|0.24|0.06|-3
goal|juniorsoundays-ui-sound-72-527849|0.35|0.07
levelup|juniorsoundays-ui-sound-57-527851|0.35|0.07
hover|u_u4pf5h7zip-click-345983|0.10|0.03
coin|justsomesounds-click-sound-432501|0.10|0.03
crown|freesound_community-chime-sound-7143|1.30|0.30
runend|freesound_community-power-down-42676|1.60|0.30
heartbeat|universfield-heartbeat-single-383748|0.45|0.10
ui|universfield-menu-button-click-147349|0.40|0.08
panel|biww-short-whoosh-swipe-sound-effect-561941|0.85|0.18|-4
swipe|biww-short-whoosh-swipe-sound-effect-561941|0.30|0.07|5
click|universfield-menu-button-click-147356|0.14|0.04|0
locked|soundshelfstudio-ui-hover-for-interfaces-519788|0.32|0.10|-2
"

# Stille weg, Mono, Laenge deckeln, ausblenden, auf -1 dBFS normalisieren.
# `silenceremove` schneidet vorn UND hinten, `alimiter` haelt den Ausgang
# sauber unter 0 dBFS, nachdem `volume` den gemessenen Spitzenwert anhebt.
echo "$TABLE" | while IFS='|' read -r id src maxlen fade semis; do
  [ -z "$id" ] && continue
  in="$SRC/$src.mp3"
  [ -f "$in" ] || { echo "  FEHLT  $in"; continue; }
  semis="${semis:-0}"


  tmp="$OUT/.$id.wav"
  ffmpeg -nostdin -v error -y -i "$in" \
    -af "silenceremove=start_periods=1:start_threshold=-50dB:detection=peak,areverse,silenceremove=start_periods=1:start_threshold=-50dB:detection=peak,areverse" \
    -ac 1 -ar 48000 "$tmp"

  # Tonhoehe in einem EIGENEN Durchgang. `asetrate` deutet die Samples
  # schneller oder langsamer, `aresample` bringt sie zurueck auf 48 kHz —
  # kein Tonhoehen-Algorithmus, der Klang wird als Ganzes gestaucht oder
  # gedehnt. Genau das will man fuer Gesten.
  #
  # Warum ein eigener Durchgang und nicht dieselbe Filterkette: zusammen
  # mit dem `areverse` des Stille-Schnitts liefert `asetrate` je nach
  # Quelle falsche Laengen. Beim Whoosh stimmte es, beim kurzen Blip kam
  # aus -5 Halbtoenen eine KUERZERE statt einer laengeren Datei. Getrennt
  # trifft das Ergebnis die Erwartung auf die Millisekunde.
  if [ "$semis" != "0" ]; then
    rate=$(awk -v s="$semis" 'BEGIN{printf "%d", 48000 * 2 ^ (s/12)}')
    ffmpeg -nostdin -v error -y -i "$tmp" -af "asetrate=$rate,aresample=48000" \
      -ac 1 -ar 48000 "$tmp.p.wav"
    mv -f "$tmp.p.wav" "$tmp"
  fi

  # Auf die Rolle kuerzen und ausblenden, damit der Schnitt nicht klickt.
  len=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$tmp")
  cut=$(awk -v l="$len" -v m="$maxlen" 'BEGIN{print (m>0 && l>m) ? m : l}')
  fadeat=$(awk -v c="$cut" -v f="$fade" 'BEGIN{s=c-f; print (s<0)?0:s}')

  # Spitzenpegel messen und exakt auf -1 dBFS legen.
  peak=$(ffmpeg -nostdin -hide_banner -i "$tmp" -af volumedetect -f null /dev/null 2>&1 \
         | sed -n 's/.*max_volume: \(.*\) dB.*/\1/p')
  gain=$(awk -v p="${peak:-0}" 'BEGIN{printf "%.2f", -1.0 - p}')

  ffmpeg -nostdin -v error -y -i "$tmp" \
    -af "atrim=0:$cut,afade=t=out:st=$fadeat:d=$fade,volume=${gain}dB,alimiter=limit=0.95" \
    -ac 1 -ar 48000 -c:a libmp3lame -q:a 5 "$OUT/$id.mp3"
  rm -f "$tmp"

  printf "  %-10s %5.2fs  %+6sdB  %+3s st  %s\n" "$id" "$cut" "$gain" "$semis" "$src"
done

# ---------------------------------------------------------------- Feuer ---
# Der Brenn-Loop laeuft, solange irgendein Peg brennt, und braucht deshalb
# eine nahtlose Naht. Ein simples Wiederholen knackt an der Schnittstelle.
# Trick: das letzte Stueck wird ueber den Anfang geblendet (`acrossfade`) —
# danach ist Dateiende gleich Dateianfang.
#
# Die Blende muss ECHT KUERZER sein als der kuerzere der beiden Eingaenge.
# Ist sie gleich lang, liefert `acrossfade` ohne Fehlermeldung eine leere
# Datei. Deshalb bekommt das Schwanzstueck den Zuschlag MARGIN.
FIRE="$SRC/dragon-studio-fire-sounds-356121.mp3"
XF=0.9
MARGIN=0.15
if [ -f "$FIRE" ]; then
  ffmpeg -nostdin -v error -y -i "$FIRE"     -af "silenceremove=start_periods=1:start_threshold=-50dB:detection=peak"     -ac 1 -ar 48000 "$OUT/.fire.wav"

  flen=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/.fire.wav")
  cutat=$(awk -v l="$flen" -v x="$XF" -v m="$MARGIN" 'BEGIN{printf "%.3f", l-x-m}')

  ffmpeg -nostdin -v error -y -i "$OUT/.fire.wav"     -af "atrim=0:$cutat,asetpts=PTS-STARTPTS" "$OUT/.head.wav"
  ffmpeg -nostdin -v error -y -i "$OUT/.fire.wav"     -af "atrim=$cutat,asetpts=PTS-STARTPTS" "$OUT/.tail.wav"
  ffmpeg -nostdin -v error -y -i "$OUT/.tail.wav" -i "$OUT/.head.wav"     -filter_complex "acrossfade=d=$XF:c1=tri:c2=tri" "$OUT/.loop.wav"

  peak=$(ffmpeg -nostdin -hide_banner -i "$OUT/.loop.wav" -af volumedetect -f null /dev/null 2>&1          | sed -n 's/.*max_volume: \(.*\) dB.*//p')
  gain=$(awk -v p="${peak:-0}" 'BEGIN{printf "%.2f", -1.0 - p}')
  ffmpeg -nostdin -v error -y -i "$OUT/.loop.wav"     -af "volume=${gain}dB,alimiter=limit=0.95"     -ac 1 -ar 48000 -c:a libmp3lame -q:a 5 "$OUT/fire.mp3"

  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/fire.mp3")
  rm -f "$OUT/.fire.wav" "$OUT/.head.wav" "$OUT/.tail.wav" "$OUT/.loop.wav"
  printf "  %-10s %5.2fs  %+6sdB  %s (nahtlos geschlossen)
"     "fire" "$dur" "$gain" "dragon-studio-fire-sounds-356121"
fi

echo
echo "Gesamt: $(du -sh "$OUT" | cut -f1) in $OUT"
