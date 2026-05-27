// swift-tools-version: 6.1

import PackageDescription

let package = Package(
    name: "EditorialStyle",
    platforms: [
        .iOS(.v18),
        .macOS(.v15)
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
