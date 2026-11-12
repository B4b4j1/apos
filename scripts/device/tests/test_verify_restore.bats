#!/usr/bin/env bats

setup() {
  FAKE_BIN="$BATS_TEST_TMPDIR/bin"; mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/ssh" <<'SH'
#!/usr/bin/env bash
# Faux ssh : FAKE_SSH_FAIL=1 simule une connexion impossible ; FAKE_LS donne le listing distant.
[[ "${FAKE_SSH_FAIL:-0}" == "1" ]] && exit 255
case "$*" in
  *"ls /usr/palm/services"*) printf '%s\n' "${FAKE_LS:-}" ;;
  *) echo "$*" >> "$BATS_TEST_TMPDIR/ssh.log" ;;
esac
SH
  chmod +x "$FAKE_BIN/ssh"
  export PATH="$FAKE_BIN:$PATH"
  printf 'svcA\n' > "$BATS_TEST_TMPDIR/services.txt"
  export SERVICES_FILE="$BATS_TEST_TMPDIR/services.txt"
  mkdir -p "$BATS_TEST_TMPDIR/backup"
}

@test "verify: disabled service is not reported as active" {
  FAKE_LS="svcA.disabled-by-apos" run bash scripts/device/verify-telemetry.sh 192.0.2.10
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "verify: enabled service is reported and exits non-zero" {
  FAKE_LS="svcA" run bash scripts/device/verify-telemetry.sh 192.0.2.10
  [ "$status" -eq 1 ]
  [[ "$output" == *"ACTIFS"* ]]
}

@test "verify: unreachable device is never reported as OK" {
  FAKE_SSH_FAIL=1 run bash scripts/device/verify-telemetry.sh 192.0.2.10
  [ "$status" -ne 0 ]
  [[ "$output" != *"OK"* ]]
}

@test "restore: unreachable device fails instead of claiming success" {
  FAKE_SSH_FAIL=1 run bash scripts/device/restore-telemetry.sh "$BATS_TEST_TMPDIR/backup" 192.0.2.10
  [ "$status" -ne 0 ]
  [[ "$output" != *"restaurés"* ]]
}

@test "restore: renames back disabled services" {
  FAKE_LS="svcA.disabled-by-apos" run bash scripts/device/restore-telemetry.sh "$BATS_TEST_TMPDIR/backup" 192.0.2.10
  [ "$status" -eq 0 ]
  grep -q "svcA.disabled-by-apos' '/usr/palm/services/svcA'" "$BATS_TEST_TMPDIR/ssh.log"
}

@test "restore: refuses to run without a backup folder" {
  FAKE_LS="svcA.disabled-by-apos" run bash scripts/device/restore-telemetry.sh "$BATS_TEST_TMPDIR/absent" 192.0.2.10
  [ "$status" -ne 0 ]
}
