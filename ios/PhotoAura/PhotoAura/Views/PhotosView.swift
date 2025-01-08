//
//  PhotosView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 2/1/24.
//

import SwiftUI
import Photos
import CachedAsyncImage
import MasonryStack

struct PhotosView: View {
    @EnvironmentObject var vm: ViewModel
    
    // State for alert and album name
    @State private var showingSaveAlbumAlert = false
    @State private var newAlbumName = ""
    @State private var showingCarousel = false
    @State private var selectedPhotoIndex = 0 // Keep track of the selected photo index
    
    init() {
        UIPageControl.appearance().currentPageIndicatorTintColor = .buttonDefault
        UIPageControl.appearance().pageIndicatorTintColor = .buttonDefault.withAlphaComponent(0.2)
        UINavigationBar.appearance().largeTitleTextAttributes = [
            .font: UIFont(name: "Lato-Bold", size: 36)!
        ]
    }
    
    var body: some View {
//        NavigationStack {
                ScrollView {
                    VStack {
                        LazyVGrid(
                            columns: Array(repeating: GridItem(.flexible(), spacing: 1), count: 3),
                            spacing: 1
                        ) {
                            ForEach(vm.photos.indices, id: \.self) { index in
                                let photo = vm.photos[index]
                                PhotoView(photo: photo)
                                    .onTapGesture {
                                        self.selectedPhotoIndex = index
                                        self.showingCarousel = true
                                    }
                            }
                        }
                    }
                }
                .scrollIndicators(.hidden)
                .defaultScrollAnchor(.bottom)
                .sheet(isPresented: $showingCarousel) {
                    PhotoCarouselView(photos: vm.photos, selectedIndex: $selectedPhotoIndex)
                }
                .onAppear {
                    Task {
                        do {
                            try await vm.getPhotos()
                        } catch {
                            print("Error loading photos")
                        }
                    }
                }
        
                .onAppear {
                    Task {
                        do {
                            try await vm.getAlbums()
                        } catch {
                            print("Error loading albums")
                        }
                    }
                }
               
            
//        }
    }
}

struct PhotoView: View {
    let photo: PhotosModel
    @State var savedAlert: Bool = false
    @State var deleteAlert: Bool = false
    
    @EnvironmentObject var vm: ViewModel
    @State var slug: String?
    
    var body: some View {
        VStack {
            CachedAsyncImage(url: URL(string: photo.compressedImage)) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                    .clipped()
                    .aspectRatio(1, contentMode: .fit)
                    .contextMenu {
                        Button(action: {
                            if let modifiedURL = URL(string: photo.image.replacingOccurrences(of: "/compressed", with: "")) {
                                Task {
                                    do {
                                        try await saveImageToPhotos(url: modifiedURL)
                                        savedAlert = true
                                    } catch {
                                        print("Failed to save image: \(error.localizedDescription)")
                                    }
                                }
                            }
                        }) {
                            Label("Save to Photos", systemImage: "square.and.arrow.down")
                        }
                        
                        if slug != nil {
                            Button(action: {
                                Task {
                                    do {
                                        try await vm.deletePhoto(slug: slug!, photoName: photo.fileMetadata.fileName)
                                        try await vm.getAlbum(slug: slug!)
                                    } catch {
                                        print("Failed to delete image: \(error.localizedDescription)")
                                    }
                                }
                            }) {
                                Label("Delete Photo", systemImage: "xmark.circle")
                                    .foregroundStyle(.textDestructiveDefault)
                            }
                        }
                    }
            } placeholder: {
                Rectangle()
                    .foregroundStyle(.ultraThickMaterial)
                    .aspectRatio(1, contentMode: .fill) // Placeholder with square aspect ratio
            }
        }
        .alert("Photo Saved", isPresented: $savedAlert) {
            Button("Ok", role: .cancel) {
                savedAlert = false
            }
        }
        .alert("Photo Deleted", isPresented: $deleteAlert) {
            Button("Ok", role: .cancel) {
                deleteAlert = false
            }
        }
    }
}
struct PhotoCarouselView: View {
    var photos: [PhotosModel]
    @Binding var selectedIndex: Int
    @State private var savedAlert: Bool = false
    
    var body: some View {
        NavigationStack {
            VStack {
                // Photo Carousel
                TabView(selection: $selectedIndex) {
                    ForEach(photos.indices, id: \.self) { index in
                        if let url = URL(string: photos[index].image) {
                            CachedAsyncImage(url: url) { image in
                                image.resizable().scaledToFit()
                            } placeholder: {
                                ProgressView()
                            }
                            .padding()
                        }
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                
                // Navigation Buttons
                HStack(spacing: 20) {
                    navigationButton(
                        systemName: "arrow.left",
                        isEnabled: selectedIndex > 0,
                        action: {
                            withAnimation {
                                if selectedIndex > 0 { selectedIndex -= 1 }
                            }
                        }
                    )
                    
                    navigationButton(
                        systemName: "arrow.right",
                        isEnabled: selectedIndex < photos.count - 1,
                        action: {
                            withAnimation {
                                if selectedIndex < photos.count - 1 { selectedIndex += 1 }
                            }
                        }
                    )
                }
                .padding(.top)
            }
            .background(Color(UIColor.systemBackground))
            
            // Save Button in Toolbar
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: saveCurrentPhoto) {
                        Image(systemName: "square.and.arrow.down")
                            .font(.title2)
                            .foregroundStyle(.primary)
                    }
                }
            }
        }
        .alert("Photo Saved", isPresented: $savedAlert) {
            Button("OK", role: .cancel) { savedAlert = false }
        }
    }
    
    // MARK: - Helper Methods
    private func saveCurrentPhoto() {
        if let modifiedURL = URL(string: photos[selectedIndex].image.replacingOccurrences(of: "/compressed", with: "")) {
            Task {
                do {
                    try await saveImageToPhotos(url: modifiedURL)
                    savedAlert = true
                } catch {
                    print("Failed to save image: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private func navigationButton(systemName: String, isEnabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.title2)
                .foregroundStyle(isEnabled ? .primary : .secondary)
                .frame(width: 44, height: 44)
                .background(Color(UIColor.systemGray6))
                .cornerRadius(8)
        }
        .disabled(!isEnabled)
    }
}

// MARK: - Save Image to Photos Library
func saveImageToPhotos(url: URL) async throws {
    let (data, _) = try await URLSession.shared.data(from: url)
    try await PHPhotoLibrary.shared().performChanges {
        let creationRequest = PHAssetCreationRequest.forAsset()
        creationRequest.addResource(with: .photo, data: data, options: nil)
    }
    print("Successfully saved image to Photos library")
}

func saveImageToPhotos(url: URL, album: PHAssetCollection) async {
    do {
        let (data, _) = try await URLSession.shared.data(from: url)
        try await PHPhotoLibrary.shared().performChanges {
            let creationRequest = PHAssetCreationRequest.forAsset()
            creationRequest.addResource(with: .photo, data: data, options: nil)
            
            guard let addAssetRequest = PHAssetCollectionChangeRequest(for: album),
                  let placeholder = creationRequest.placeholderForCreatedAsset else { return }
            addAssetRequest.addAssets([placeholder] as NSArray)
        }
        print("Successfully saved image to album: \(album.localizedTitle ?? "")")
    } catch {
        print("Error saving image: \(error.localizedDescription)")
    }
}
