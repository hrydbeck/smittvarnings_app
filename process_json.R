#!/usr/bin/env Rscript
suppressPackageStartupMessages({
  library(rjson)
  library(tidyverse)
  library(readr)
  library(lubridate)
})

# Ensure a timezone is defined (prevents attempting to call systemd timedatectl on
# environments without systemd such as WSL or some containers)
if (is.na(Sys.getenv('TZ')) || Sys.getenv('TZ') == "") {
  Sys.setenv(TZ = 'UTC')
  cat('ℹ️ TZ not set - defaulting to UTC\n')
} else {
  cat(sprintf('ℹ️ TZ is %s\n', Sys.getenv('TZ')))
}

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 3) {
  stop("Usage: Rscript process_json.R <results_base> <update_label> <file1> [file2 ...]")
}

results_base <- args[1]
update_label <- args[2]
files <- args[-c(1,2)]

if (length(files) == 0) {
  cat("⚠️ No JSON files passed. Exiting.\n")
  quit(status = 0)
}

# derive output folder from input folder name
input_folder_name <- basename(dirname(files[1]))
output_folder <- file.path(results_base, input_folder_name)
if (!dir.exists(output_folder)) dir.create(output_folder, recursive = TRUE)

date_str <- format(Sys.Date(), "%Y-%m-%d")
# Use double date format like mimosa
output_path_profile <- file.path(output_folder, paste0("cgmlst.profile.", update_label, "_", date_str, "_", date_str))
output_path_meta <- file.path(output_folder, paste0("metadata.tsv.", update_label, "_", date_str, "_", date_str))

cat("📤 Output folder:", output_folder, "\n")
cat("📝 profile:", output_path_profile, "\n")
cat("📝 metadata:", output_path_meta, "\n")

# Read and parse JSONs
list_of_dfs <- vector("list", length(files))
list_of_row_names <- vector("list", length(files))

for (i in seq_along(files)) {
  f <- files[i]
  my.JSON <- fromJSON(file = f)

  # Extract allele data and identifiers (best-effort, following provided structure)
  # typing_result may be a list of entries; find any element that contains result$alleles
  alleles <- tibble()
  if (!is.null(my.JSON$typing_result) && length(my.JSON$typing_result) > 0) {
    # Prefer cgmlst typing results (many allele columns). Fall back to any alleles (e.g., mlst).
    # First pass: find explicit cgmlst entry
    for (entry in my.JSON$typing_result) {
      try({
        etype <- entry[["type"]]
      }, silent = TRUE)
      if (!is.null(entry[["type"]]) && tolower(entry[["type"]]) == "cgmlst") {
        a <- tryCatch(entry[["result"]][["alleles"]], error = function(e) NULL)
        if (!is.null(a) && length(a) > 0) {
          alleles <- as_tibble_row(unlist(a))
          break
        }
      }
      if (!is.null(entry[["software"]]) && grepl("chewbbaca|cgmlst|chew", tolower(as.character(entry[["software"]])))) {
        a <- tryCatch(entry[["result"]][["alleles"]], error = function(e) NULL)
        if (!is.null(a) && length(a) > 0) {
          alleles <- as_tibble_row(unlist(a))
          break
        }
      }
    }
    # Second pass: if not found, take any alleles present (e.g., MLST)
    if (ncol(alleles) == 0) {
      for (entry in my.JSON$typing_result) {
        a <- tryCatch(entry[["result"]][["alleles"]], error = function(e) NULL)
        if (!is.null(a) && length(a) > 0) {
          alleles <- as_tibble_row(unlist(a))
          break
        }
      }
    }
  }
  list_of_dfs[[i]] <- alleles

  # Extract sample identifier (try several common places, fallback to filename)
  jasenid <- tryCatch({
    if (!is.null(my.JSON$jasenid)) return(as.character(my.JSON$jasenid))
    if (!is.null(my.JSON$sample)) return(as.character(my.JSON$sample))
    if (!is.null(my.JSON[[1]]$jasenid)) return(as.character(my.JSON[[1]]$jasenid))
    NULL
  }, error = function(e) NULL)
  if (is.null(jasenid) || jasenid == "") jasenid <- tools::file_path_sans_ext(basename(f))
  rn <- tibble(jasenid = jasenid)
  list_of_row_names[[i]] <- rn

  # Debug output: show what we extracted for this file
  cat(sprintf("🔎 Processed file: %s -> jasenid=%s\n", f, jasenid))
  if (ncol(alleles) == 0) {
    cat("   ⚠️ No alleles found in this file. Available top-level keys:", paste(names(my.JSON), collapse=", "), "\n")
    if (!is.null(my.JSON$typing_result)) {
      cat(sprintf("   typing_result has %d entries.\n", length(my.JSON$typing_result)))
    }
  } else {
    cat(sprintf("   ✅ Extracted %d allele calls (showing up to 10): %s\n", ncol(alleles), paste(names(alleles)[1:min(10, ncol(alleles))], collapse=", ")))
  }
}

df <- bind_rows(list_of_dfs)
rownames <- bind_rows(list_of_row_names)
if (ncol(rownames) >= 1) names(rownames) <- "jasenid"

if (nrow(df) == 0) {
  cat("⚠️ No allele data extracted. Writing empty profile and exiting.\n")
  write_tsv(tibble(), output_path_profile)
  write_tsv(tibble(), output_path_meta)
  quit(status = 0)
}

df2 <- cbind(rownames, df) %>% as_tibble()

replace_codes <- c("ASM","EXC","INF","LNF","PLNF","PLOT3","PLOT5","LOTC",
                   "NIPH","NIPHEM","PAMA","ALM")

# Ensure jasenid is first, all allele columns follow in sorted order for stable output
allele_cols <- setdiff(names(df2), "jasenid")
allele_cols_sorted <- sort(allele_cols)

# Convert allele columns to character, replace known missing codes and NA with "0"
df2_clean <- df2 %>%
  mutate(across(all_of(allele_cols_sorted), ~ as.character(.))) %>%
  mutate(across(all_of(allele_cols_sorted), ~replace(., . %in% replace_codes, "0"))) %>%
  mutate(across(all_of(allele_cols_sorted), ~replace_na(., "0")))

df3 <- df2_clean %>% select(jasenid, all_of(allele_cols_sorted))

write_tsv(df3, output_path_profile)
cat("✅ cgMLST profile written:\n -", output_path_profile, "\n")

# Create fake metadata
mimosa_count <- c("Sverige","Norge","Danmark")
mimosa_regions <- c("A","B","C","D")
mimosa_dates <- seq(Sys.Date() - months(3), Sys.Date(), by = "1 day")

set.seed(69)
fake_metadata <- data.frame(
  sample = dplyr::pull(rownames, jasenid),
  Country = sample(mimosa_count, size = nrow(rownames), replace = TRUE),
  Region = sample(mimosa_regions, size = nrow(rownames), replace = TRUE),
  Source = rep("clinical", nrow(rownames)),
  Date = sample(mimosa_dates, size = nrow(rownames), replace = TRUE),
  Note = rep("some notes", nrow(rownames))
)

write_tsv(fake_metadata, output_path_meta)
cat("✅ Fake metadata written:\n -", output_path_meta, "\n")

cat("🎉 Done processing update:", update_label, "\n")
