//
//  ContentView.swift
//  EditorialStyleTheme
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI
import EditorialStyle

struct ContentView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var name = "Geeth Gunnampalli"
    @State private var orientation = "all"
    @State private var activeFace: String? = "Geeth"

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    EditorialBrandHeader(logoSize: 56)

                    VStack(spacing: EditorialSpacing.xxLarge) {
                        section("01 Type") { typographySample }
                        section("02 Buttons") { buttonsSample }
                        section("03 Inputs") { inputsSample }
                        section("04 Badges") { badgesSample }
                        section("05 Section header") { sectionHeaderSample }
                        section("06 Segmented") { segmentedSample }
                        section("07 Avatars") { avatarsSample }
                        section("08 List rows") { listRowsSample }
                        section("09 Photo cards") { photoCardsSample }
                        section("10 Stat cards") { statsSample }
                        section("11 Face chips") { facesSample }
                        section("12 Progress") { progressSample }
                        section("13 Skeleton") { skeletonSample }
                        section("14 Empty state") { emptyStateSample }
                    }
                    .padding(.horizontal, EditorialSpacing.screenGutter)
                    .padding(.bottom, EditorialSpacing.xxxLarge)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private func section<Content: View>(_ index: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            HStack(spacing: EditorialSpacing.small) {
                Rectangle().fill(EditorialColors.brand).frame(width: 24, height: 1)
                Text(index).editorialEyebrow(color: EditorialColors.textMuted)
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var typographySample: some View {
        EditorialCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("PhotoAura").editorialWordmark(size: 36)
                Text("Your gallery is ready").editorialEyebrow()
                Text("Goa Rooftop, Vol. 02").editorialHeading()
                Text("Hi Geeth — your photos are ready.").editorialSubtitle()
                Text("Inside you can browse the full shoot.").editorialBody()
                Text("This link expires in 30 minutes.").editorialHint()
            }
        }
    }

    private var buttonsSample: some View {
        EditorialCard {
            VStack(spacing: 12) {
                EditorialButton("View your gallery") {}
                EditorialButton("Secondary", style: .secondary) {}
                EditorialButton("Ghost", style: .ghost) {}
                EditorialButton("Loading…", isLoading: true) {}
                EditorialButton("Disabled", isDisabled: true) {}
            }
        }
    }

    private var inputsSample: some View {
        EditorialCard {
            VStack(spacing: 16) {
                EditorialTextField("you@example.com", text: $email, label: "Email", kind: .email)
                EditorialTextField("•••••••", text: $password, label: "Password", kind: .password)
                EditorialTextField("Full name", text: $name, label: "Name")
            }
        }
    }

    private var badgesSample: some View {
        EditorialCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    EditorialBadge("Primary")
                    EditorialBadge("Shared", tone: .brand)
                    EditorialBadge("Verified", tone: .success, icon: "checkmark")
                }
                HStack(spacing: 8) {
                    EditorialBadge("Pending", tone: .muted, icon: "clock")
                    EditorialBadge("Admin", tone: .brand)
                    EditorialBadge("Failed", tone: .danger, icon: "exclamationmark")
                }
            }
        }
    }

    private var sectionHeaderSample: some View {
        EditorialCard {
            VStack(alignment: .leading, spacing: 28) {
                EditorialSectionHeader(
                    title: "Welcome back, Geeth",
                    eyebrow: "Overview",
                    subtitle: "A quiet snapshot of your studio."
                )
                EditorialSectionHeader(title: "Recent albums", eyebrow: "Library", style: .section)
            }
        }
    }

    private var segmentedSample: some View {
        EditorialCard {
            EditorialSegmentedControl(
                items: [("All", "all"), ("Portrait", "portrait"), ("Landscape", "landscape")],
                selection: $orientation
            )
        }
    }

    private var avatarsSample: some View {
        EditorialCard {
            HStack(spacing: 12) {
                EditorialAvatar(fullName: "Geeth Gunnampalli", size: 36)
                EditorialAvatar(fullName: "Geeth Gunnampalli", size: 44)
                EditorialAvatar(fullName: "Sam Reactive", size: 56)
                EditorialAvatar(initials: "?")
                Spacer()
            }
        }
    }

    private var listRowsSample: some View {
        EditorialCard(padding: EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16)) {
            VStack(spacing: 0) {
                EditorialListRow(title: "Geeth Gunnampalli", subtitle: "geeth@reactiveshots.com") {
                    EditorialAvatar(fullName: "Geeth Gunnampalli")
                } trailing: {
                    EditorialBadge("Admin", tone: .brand)
                }
                EditorialListRow(title: "Sam Reactive", subtitle: "sam@reactiveshots.com") {
                    EditorialAvatar(fullName: "Sam Reactive")
                } trailing: {
                    EditorialBadge("Client")
                }
                EditorialListRow(title: "geeth0924@gmail.com", subtitle: "Verified · added May 24") {
                    Image(systemName: "envelope")
                        .foregroundStyle(EditorialColors.textMuted)
                        .frame(width: 44, height: 44)
                } trailing: {
                    EditorialBadge("Verified", tone: .success, icon: "checkmark")
                }
            }
        }
    }

    private var photoCardsSample: some View {
        VStack(spacing: 12) {
            EditorialPhotoCard(title: "Goa Rooftop, Vol. 02", caption: "248 photos") {
                LinearGradient(colors: [Color(red:0.2,green:0.3,blue:0.5), Color(red:0.4,green:0.5,blue:0.7)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            }
            EditorialPhotoCard(title: "Studio session", caption: "62 photos", aspect: 16/10) {
                LinearGradient(colors: [Color(red:0.5,green:0.3,blue:0.3), Color(red:0.7,green:0.4,blue:0.4)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
    }

    private var statsSample: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            EditorialStatCard(label: "Albums", value: "24", footnote: "+3 this month", systemImage: "rectangle.stack")
            EditorialStatCard(label: "Photos", value: "1,284", systemImage: "photo")
            EditorialStatCard(label: "Faces", value: "37", footnote: "12 named", systemImage: "person.crop.circle")
            EditorialStatCard(label: "Clients", value: "8", systemImage: "person.2")
        }
    }

    private var facesSample: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 14) {
                ForEach(["Geeth", "Sam", "Priya", "Aman"], id: \.self) { name in
                    EditorialFaceChip(name: name, isActive: activeFace == name) {
                        activeFace = activeFace == name ? nil : name
                    } image: {
                        LinearGradient(
                            colors: gradientFor(name),
                            startPoint: .top, endPoint: .bottom
                        )
                    }
                }
            }
            .padding(.horizontal, 2)
        }
    }

    private func gradientFor(_ name: String) -> [Color] {
        switch name {
        case "Geeth": return [.purple, .pink]
        case "Sam": return [.blue, .cyan]
        case "Priya": return [.orange, .red]
        default: return [.green, .teal]
        }
    }

    private var progressSample: some View {
        EditorialCard {
            VStack(spacing: 24) {
                EditorialProgressBar(progress: 0.34, stage: "Uploading", detail: "8 of 24")
                EditorialProgressBar(progress: 0.72, stage: "Detecting faces", detail: "72%")
                EditorialProgressBar(progress: 1.0, stage: "Done", detail: "24 of 24")
            }
        }
    }

    private var skeletonSample: some View {
        EditorialCard {
            VStack(spacing: 12) {
                EditorialSkeleton(height: 24)
                EditorialSkeleton(height: 14)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    EditorialSkeleton(aspect: 1)
                    EditorialSkeleton(aspect: 1)
                }
            }
        }
    }

    private var emptyStateSample: some View {
        EditorialEmptyState(
            systemImage: "photo.on.rectangle",
            title: "No albums yet",
            subtitle: "Create your first collection to get started.",
            actionTitle: "New album"
        ) {}
    }
}

#Preview {
    ContentView()
}
