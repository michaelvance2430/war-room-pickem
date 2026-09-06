#!/usr/bin/env ruby
# frozen_string_literal: true

require "set"

source_path = File.expand_path("../native-ios/WarRoom/ContentView.swift", __dir__)
assets_path = File.expand_path("../native-ios/WarRoom/Assets.xcassets", __dir__)
source = File.read(source_path)

def required_match(source, pattern, label)
  match = source.match(pattern)
  abort "Native Cheevo artwork audit could not find #{label}; update the audit for the current catalog layout" unless match
  match[1]
end

catalog_body = required_match(source, /private static let raw = """(.*?)"""/m, "the native Cheevo catalog")
catalog = catalog_body.lines.map do |line|
  code, name = line.strip.split("|", 2)
  [code, name] if code && name
end.compact.to_h

rarity_ids = {}
%w[legendary epic rare].each do |rarity|
  body = required_match(source, /let #{rarity}: Set<String> = \[(.*?)\n\s*\]/m, "the #{rarity} rarity set")
  body.scan(/"([^"]+)"/).flatten.each { |code| rarity_ids[code] = rarity.upcase }
end
catalog.each_key { |code| rarity_ids[code] ||= "COMMON" }

mapping_body = required_match(source, /private func achievementArtifactName\(for code: String\) -> String\? \{(.*?)\n\}/m, "the dedicated artwork map")
artwork = {}
mapping_body.scan(/case\s+([^:]+):\s+return\s+"([^"]+)"/) do |cases, asset|
  cases.scan(/"([^"]+)"/).flatten.each { |code| artwork[code] = asset }
end

visual_body = required_match(source, /(?:private\s+)?func achievementVisual\(for code: String\) -> AchievementVisual \{(.*?)\n\}/m, "the generated visual map")
explicit_visuals = visual_body.scan(/case\s+([^:]+):\s+return/).flatten.flat_map do |cases|
  cases.scan(/"([^"]+)"/).flatten
end.to_set

generated = []
uncovered = []
broken = []
catalog.each_key do |code|
  asset = artwork[code]
  if asset.nil?
    row = [rarity_ids.fetch(code), code]
    explicit_visuals.include?(code) ? generated << row : uncovered << row
    next
  end

  imageset = File.join(assets_path, "#{asset}.imageset")
  unless Dir.exist?(imageset) && File.exist?(File.join(imageset, "Contents.json"))
    broken << [rarity_ids.fetch(code), code, asset]
  end
end

fallback_assets = %w[
  CommonUnlockedCheevoArtifact CommonNflCheevoArtifact CommonCfbCheevoArtifact
  CommonFieldhouseCheevoArtifact RareFallbackCheevoArtifact
  EpicFallbackCheevoArtifact LegendaryFallbackCheevoArtifact
]
fallback_assets.each do |asset|
  imageset = File.join(assets_path, "#{asset}.imageset")
  broken << ["FALLBACK", "generated-art-system", asset] unless Dir.exist?(imageset) && File.exist?(File.join(imageset, "Contents.json"))
end

puts "Native Cheevo artwork audit"
puts "Catalog: #{catalog.length}"
puts "Dedicated artwork: #{artwork.keys.count { |code| catalog.key?(code) }}"
puts "Generated artifact + unique emblem: #{generated.length}"
puts "Uncovered: #{uncovered.length}"
puts "Broken asset references: #{broken.length}"

%w[LEGENDARY EPIC RARE COMMON].each do |rarity|
  rows = uncovered.select { |row| row[0] == rarity }
  puts "\n#{rarity} uncovered (#{rows.length})"
  rows.each { |_, code| puts code }
end

unless broken.empty?
  puts "\nBROKEN REFERENCES"
  broken.each { |rarity, code, asset| puts "#{rarity} #{code} -> #{asset}" }
end

exit 1 unless uncovered.empty? && broken.empty?
