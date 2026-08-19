#!/usr/bin/env ruby
# frozen_string_literal: true

require "set"

source_path = File.expand_path("../native-ios/WarRoom/ContentView.swift", __dir__)
assets_path = File.expand_path("../native-ios/WarRoom/Assets.xcassets", __dir__)
source = File.read(source_path)

catalog_body = source.match(/private static let raw = """(.*?)"""/m)[1]
catalog = catalog_body.lines.map do |line|
  code, name = line.strip.split("|", 2)
  [code, name] if code && name
end.compact.to_h

rarity_ids = {}
%w[legendary epic rare].each do |rarity|
  body = source.match(/let #{rarity}: Set<String> = \[(.*?)\n\s*\]/m)[1]
  body.scan(/"([^"]+)"/).flatten.each { |code| rarity_ids[code] = rarity.upcase }
end
catalog.each_key { |code| rarity_ids[code] ||= "COMMON" }

mapping_body = source.match(/private func achievementArtifactName\(for code: String\) -> String\? \{(.*?)\n\}/m)[1]
artwork = {}
mapping_body.scan(/case\s+([^:]+):\s+return\s+"([^"]+)"/) do |cases, asset|
  cases.scan(/"([^"]+)"/).flatten.each { |code| artwork[code] = asset }
end

visual_body = source.match(/private func achievementVisual\(for code: String\) -> AchievementVisual \{(.*?)\n\}/m)[1]
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
