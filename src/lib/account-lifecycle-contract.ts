/**
 * Account lifecycle product contract.
 *
 * This file intentionally exposes no mutation functions. The current database
 * has cascading profile foreign keys that can erase competitive history, so
 * neither exit may ship until its protected server path passes Foundry.
 */

export const ACCOUNT_LIFECYCLE_PUBLIC = true as const;

export const MIA_DISPLAY_LABEL = "MIA" as const;
export const REDACTED_DISPLAY_NAME = "[REDACTED]" as const;

export const ACCOUNT_EXITS = {
  mia: {
    action: "GO MIA",
    reversible: true,
    description:
      "Step away from the table. Your chair—and your terrible record—will remain.",
    effects: [
      "keep_account_and_history",
      "stop_optional_notifications",
      "show_mia_status",
      "allow_full_return",
    ],
  },
  deletion: {
    action: "BURN THE DOSSIER",
    reversible: false,
    description: "Delete the account. Keep the receipts.",
    effects: [
      "revoke_all_sessions",
      "delete_private_identity_data",
      "delete_private_messages_and_uploads",
      "preserve_anonymized_competitive_history",
      "replace_historical_name_with_redacted",
      "prevent_automatic_history_reclaim",
    ],
  },
} as const;

export const PERMANENT_DELETION_WARNING =
  "This permanently deletes your login and private data. Your picks, standings, trophies, and league history stay behind as [REDACTED]. This cannot be undone.";

export const HISTORICAL_REDACTION_COPY = {
  subtitle: "Former player · dossier destroyed",
  receipt: "Record preserved. Identity classified.",
  gazette: "Deleted the account. Couldn’t delete the receipts.",
} as const;

export const ACCOUNT_DELETION_RELEASE_GATES = [
  "commissioner_transfer_or_safe_room_resolution",
  "session_and_provider_token_revocation",
  "private_data_and_storage_inventory",
  "nonidentifying_historical_participant_model",
  "service_role_server_only",
  "reauthentication_and_explicit_confirmation",
  "foundry_cascade_and_rollback_proof",
  "app_review_device_test",
] as const;
