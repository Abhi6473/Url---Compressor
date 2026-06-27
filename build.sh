#!/bin/bash
set -e
npm install
g++ -O2 -o backend/main backend/main.cpp -std=c++17