#!/usr/bin/env bash

set +e +x
set -o pipefail

#Check tool dependency
SPLIT_CMD=split
if [[ $OSTYPE == 'darwin'* ]]; then
  SPLIT_CMD=gsplit
fi

hash jq 2>/dev/null || {
  echo >&2 "This script requires jq, but it's not installed. Aborting"
  exit 1
}
hash ${SPLIT_CMD} 2>/dev/null || {
  echo >&2 "This script requires split or gsplit, but it's not installed. Aborting"
  exit 1
}
hash curl 2>/dev/null || {
  echo >&2 "This script requires curl, but it's not available. Aborting"
  exit 1
}

#get the ip from the environment or default to AP IP
SHELLY_IP=${SHELLY:-192.168.33.1}
SCRIPT_ID=${SCRIPT_ID:-1}
SCRIPT_FILE=${SCRIPT_FILE:-}

RPC_ERROR_CODE=0
RPC_ERROR_MESSAGE=""

CHUNK_SIZE=800

print_help() {
  local SCRIPT_FNAME=$(basename "$0")
  echo "${SCRIPT_FNAME} - Shelly Script uploading script"
  echo "Options:"
  echo "  -s <device-ip>    - Shelly device ip. Alternatively provide SHELLY from env"
  echo "  -i <script-id>    - Script slot id to upload the script to. This script should be created already. Alternatively provide SCRIPT_ID from env"
  echo "  -f <script-file>  - File name of the script to be uploaded. Alternatively provide SCRIPT_FILE from env"
  echo "  -h                - Print this help"
}

#process options
while getopts "s:i:f:h" option; do
  case $option in
  s)
    SHELLY_IP=$OPTARG
    ;;
  i)
    SCRIPT_ID=$OPTARG
    ;;
  f)
    SCRIPT_FILE=$OPTARG
    ;;
  h)
    print_help
    exit 0
    ;;
  :)
    echo "${OPTARG} requires an argument"
    exit 1
    ;;
  ?)
    echo "Error: ${OPTARG} option is invalid"
    exit 1
    ;;
  esac
done

if [ $OPTIND -eq 1 ]; then
  print_help
  exit 0
fi

if [ -z $SCRIPT_FILE ] && $(hash dialog 2>/dev/null); then
  SCRIPT_FILE=$(dialog --title "Shelly script" --stdout --title "Please choose a script to upload" --fselect ./*.js 14 48)
fi

SHELLY_HTTP="http://${SHELLY_IP}/rpc/"

if [ ! -f "$SCRIPT_FILE" ]; then
  echo "Error: Provide script file to upload"
  exit 1
fi

#$1 shellyrpc/method, $2 params
call_shelly() {
  local PARAMS=$2
  local RESULT=$(echo $PARAMS | curl -s -H 'Content-type:application/json' --data-binary @- ${1})
  if [[ $RESULT == *"404"* ]]; then
    echo "Error calling ${1}"
    return 1
  fi
  local ERROR_CODE=$(echo $RESULT | jq ".code" -r)
  if (($ERROR_CODE < 0)); then
    RPC_ERROR_CODE=$ERROR_CODE
    RPC_ERROR_MESSAGE=$(echo $RESULT | jq ".message" -r)
    echo "Error executing method"
    return 1
  fi
  return 0
}
export -f call_shelly

#$1 - script id, $2 - script chunk
put_chunk() {
  echo -n "."
  local CHUNK=$(cat -)
  CHUNK=${CHUNK//\"/\\\"}
  local PARAMS=$(jq -rc "(.id=$2|.append=true|.code=\"$CHUNK\")" <<<'{"id":null,"code":null,"append":true}')
  call_shelly $1 "$PARAMS"
}
export -f put_chunk

#$1 - script id, $2 - script file
upload_script() {
  echo -n "Sending chunks "
  local ENDPOINT=$SHELLY_HTTP"Script.PutCode"
  $SPLIT_CMD -b $CHUNK_SIZE --filter "cat -|put_chunk $ENDPOINT $1" $2
  echo ""
}

#$1 script id
delete_script() {
  local PARAMS=$(jq -rc "(.id=$1|.code=\"//$SCRIPT_FILE\n\")" <<<'{"id":null,"code":null}')
  call_shelly $SHELLY_HTTP"Script.PutCode" "$PARAMS"
}

stop_script() {
  local PARAMS=$(jq -rc "(.id=$1)" <<<'{"id":null}')
  call_shelly $SHELLY_HTTP"Script.Stop" "$PARAMS"
}

start_script() {
  local PARAMS=$(jq -rc "(.id=$1)" <<<'{"id":null}')
  call_shelly $SHELLY_HTTP"Script.Start" "$PARAMS"
}

echo "Stopping script in slot $SCRIPT_ID"
stop_script $SCRIPT_ID

echo "Deleting script in slot $SCRIPT_ID"
delete_script $SCRIPT_ID
RET_VAL=$?

if [ $RET_VAL -ne 0 ] || [ $RPC_ERROR_CODE -lt 0 ]; then
  echo "Error deleting script $RPC_ERROR_MESSAGE"
  exit 1
fi

echo "Uploading $SCRIPT_FILE to $SHELLY_IP script slot $SCRIPT_ID in chunks of $CHUNK_SIZE bytes"
upload_script $SCRIPT_ID $SCRIPT_FILE
RET_VAL=$?
if [ $RET_VAL -ne 0 ] || [ $RPC_ERROR_CODE -lt 0 ]; then
  echo "Error calling remote Shelly"
  exit 1
fi

echo "Starting script in slot $SCRIPT_ID"
start_script $SCRIPT_ID

echo ""
echo "Done"

# Cutoff for shell scripts should be 200 lines!
