#!/usr/bin/bash
# TODO: use ts-node alternatives instead of esr
tsc --noEmit > /dev/stdout 2> /dev/stderr &
program1_pid=$!
esr src/main.ts > /dev/stdout 2> /dev/stderr &
program2_pid=$!

trap "kill $program1_pid $program2_pid 2> /dev/null" SIGINT

wait -n $program1_pid $program2_pid

if [ $? -ne 0 ]; then
  # one of the programs failed
  kill $program1_pid $program2_pid 2> /dev/null
  exit 1
fi

wait $program2_pid
