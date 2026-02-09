#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# What it does?
# > This script will parse the new JSON format for shelly script examples into the .md file for backward compatibility

# How to run it?
# > Open the terminal in the same directory as the script, then start the script with python and put the filepath after the script name. 
# > Replace the <filename> with the path to the file you want to parse. Example: "python sync-manifest-json.py ../examples-manifest.json"

# Where is the output?
# > The output "SHELLY_MJS.md" file will go in the same directory as the input file "examples-manifest.json"

from argparse import ArgumentParser
import os
import json

argparser = ArgumentParser()
argparser.add_argument("file", help="Path to the json file")

def main():
  args = argparser.parse_args()
  if not args.file:
    print("Missing file argument")
    return 
    
  if not os.path.isfile(args.file):
    print("Can not find the file")
    return


  try:
    with open(args.file, mode = "r") as file:
      json_data = json.loads(file.read())
  except Exception as e:
    print(e)


  if json_data:
    newFile = "/".join(args.file.split("/")[:-1]) + "/SHELLY_MJS.md"
    with open(newFile, mode = "w+") as file:
      for data in json_data:
        file.write(data["fname"] + ": " + data["title"] + "\n===\n" + data["description"] + "\n\n")
  

if __name__ == "__main__":
  main()
