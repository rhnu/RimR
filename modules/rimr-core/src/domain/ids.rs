//! Independent UUID identity for user-managed objects.

use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

macro_rules! define_id {
    ($name:ident, $description:literal) => {
        #[doc = $description]
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
        #[serde(transparent)]
        pub struct $name(Uuid);

        impl $name {
            /// Allocates identity independently of the object's contents.
            pub fn new() -> Self { Self(Uuid::new_v4()) }

            pub fn as_uuid(&self) -> &Uuid { &self.0 }
        }

        impl Default for $name {
            fn default() -> Self { Self::new() }
        }

        impl std::str::FromStr for $name {
            type Err = IdentityError;

            fn from_str(value: &str) -> Result<Self, Self::Err> {
                Self::try_from(Uuid::parse_str(value)?)
            }
        }

        impl TryFrom<Uuid> for $name {
            type Error = IdentityError;

            fn try_from(value: Uuid) -> Result<Self, Self::Error> {
                if value.get_version_num() != 4 || value.get_variant() != uuid::Variant::RFC4122 {
                    return Err(IdentityError::NotV4);
                }
                Ok(Self(value))
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                Self::try_from(Uuid::deserialize(deserializer)?).map_err(serde::de::Error::custom)
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { self.0.fmt(f) }
        }
    };
}

define_id!(ModListId, "Identity of a user-managed mod list.");
define_id!(EntryId, "Identity of a list entry or group child.");
define_id!(TagId, "Identity of a shared tag definition.");

/// Invalid external identity input.
#[derive(Debug, Error)]
pub enum IdentityError {
    #[error("invalid UUID: {0}")]
    Uuid(#[from] uuid::Error),
    #[error("entity identity must be an RFC4122 UUID v4")]
    NotV4,
}
