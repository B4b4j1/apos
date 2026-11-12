#!/usr/bin/env bats

@test "usage error without resolver argument" {
  run bash scripts/net/verify-dns-block.sh
  [ "$status" -ne 0 ]
  [[ "$output" == *"usage"* ]]
}

@test "fails when a blocked domain resolves to a real address" {
  run bash scripts/net/verify-dns-block.sh 127.0.0.1:5399 scripts/net/tests/fixtures/blocked.txt
  [ "$status" -ne 0 ]
}
