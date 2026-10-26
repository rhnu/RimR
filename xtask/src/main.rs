use anyhow::{Result, anyhow};
use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(author, version, about = "RimR workspace automation tasks")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Export Rust DTO bindings to TypeScript.
    ExportBindings {
        /// Check that generated bindings are up to date without rewriting files.
        #[arg(long)]
        check: bool,
    },
}

const OUTPUT_PATH: &str = "app/src/commands/generated/types.ts";

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::ExportBindings { check } => {
            let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .expect("xtask has workspace parent")
                .to_path_buf();
            let output_path = root.join(OUTPUT_PATH);
            let contents = format!("{}\n", rimr_bindings::generate_typescript().trim_end());

            if check {
                let existing = std::fs::read_to_string(&output_path).unwrap_or_default();
                if existing != contents {
                    return Err(anyhow!(
                        "{} is out of date; run `pnpm bindings`",
                        output_path.display()
                    ));
                }
                return Ok(());
            }

            if let Some(parent) = output_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(output_path, contents)?;
            Ok(())
        }
    }
}
