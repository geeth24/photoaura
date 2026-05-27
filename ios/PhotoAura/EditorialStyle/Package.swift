// swift-tools-version: 6.1

import PackageDescription

let package = Package(
    name: "EditorialStyle",
    platforms: [
        .iOS("26.0"),
        .macOS("15.0")
    ],
    products: [
        .library(
            name: "EditorialStyle",
            targets: ["EditorialStyle"]
        )
    ],
    targets: [
        .target(
            name: "EditorialStyle",
            resources: [
                .process("Resources")
            ]
        )
    ]
)
