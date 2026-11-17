#!/usr/bin/env zsh
# Records the T1 bench clips on a Mac: prompts for each phrase, saves 16 kHz mono WAV named
# after what was said (see scripts/asr-bench.ts). Re-run with a list to redo some:
#   scripts/record-asr-clips.sh            # all clips
#   scripts/record-asr-clips.sh draw-2 red-1
# Other mic: MIC="capon Microphone" scripts/record-asr-clips.sh  (list: ffmpeg -f avfoundation -list_devices true -i "")
set -eu
dir=tests/fixtures/asr
mic=${MIC:-MacBook Pro Microphone}
secs=${SECS:-2}
# Command clips (2-3 takes each) + clips that must NOT trigger anything ("drawing" ≠ "draw").
clips=(${@:-
  draw-1 draw-2 draw-3 stop-1 stop-2 stop-3 clear-1 clear-2 undo-1 undo-2
  thicker-1 thicker-2 thinner-1 thinner-2 red-1 red-2 blue-1 blue-2 green-1 black-1 white-1
  draw-red-1 stop-blue-1
  hello-there-1 what-time-is-it-1 i-am-drawing-a-picture-1 the-stopwatch-is-broken-1
  silence-1 cough-1 tap-the-desk-1
})
cd "${0:A:h}/.."
mkdir -p $dir
for clip in $clips; do
  say_this=${${clip%-<->}//-/ }
  read "?[$clip] Press Enter, then say: \"$say_this\" ($secs s) "
  ffmpeg -hide_banner -loglevel error -f avfoundation -i ":$mic" -t $secs -ar 16000 -ac 1 -y "$dir/$clip.wav"
  # A near-silent clip usually means the wrong mic or no mic permission, not quiet speech.
  peak=$(ffmpeg -hide_banner -i "$dir/$clip.wav" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9]*\).*/\1/p')
  [[ $clip == silence-* || ${peak:--99} -gt -30 ]] || echo "  ! peak ${peak} dB: too quiet, redo with: $0 $clip"
done
echo "Saved ${#clips} clips in $dir. Next: npm run bench:asr -- --url http://100.76.81.44:5092"
