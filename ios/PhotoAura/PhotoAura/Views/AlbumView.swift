//
//  AlbumView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 2/2/24.
//

import SwiftUI
import MasonryStack
import Photos
import CachedAsyncImage

struct AlbumView: View {
    @EnvironmentObject var vm: ViewModel
    @State var albumName: String
    // State for alert and album name
    @State private var showingSaveAlbumAlert = false
    @State private var newAlbumName = ""
    
    @State private var showingCarousel = false
    @State private var selectedPhotoIndex = 0 // Keep track of the selected photo index
    
    @State private var saveProgress: Float = 0.0
    @State private var isSaving = false
    
    
    var body: some View {
        NavigationStack{
            ScrollView {
                VStack {
                    if isSaving {
                        ProgressView(value: saveProgress)
                            .tint(.textDefault)
                            .progressViewStyle(LinearProgressViewStyle())
                            .frame(width: 200)
                        
                            .padding()
                    }

                    
                    MasonryVStack(columns: 2, spacing: 20) {
                        ForEach(vm.album.albumPhotos.indices, id: \.self) { index in
                            let photo = vm.album.albumPhotos[index]
                            PhotoView(photo: photo)
                                .onTapGesture {
                                    self.selectedPhotoIndex = index
                                    self.showingCarousel = true
                                }
                        }
                    }
                    .padding(20)
                    
                }
            }
            .sheet(isPresented: $showingCarousel) {
                PhotoCarouselView(photos: vm.album.albumPhotos, selectedIndex: $selectedPhotoIndex)
                
                
            }
            .onAppear {
                UIPageControl.appearance().currentPageIndicatorTintColor = .buttonDefault
                UIPageControl.appearance().pageIndicatorTintColor = .buttonDefault.withAlphaComponent(0.2)
                UINavigationBar.appearance().largeTitleTextAttributes = [.font : UIFont(name: "Lato-Bold", size: 36)!]
                
                Task {
                    do {
                        try await vm.getAlbum(albumName: albumName)
                        newAlbumName = albumName
                    } catch {
                        print("Error loading photos")
                    }
                }
            }
            .navigationTitle(albumName)
            .toolbar(content: {
                Button {
                    showingSaveAlbumAlert = true
                } label: {
                    Image(systemName: "square.and.arrow.down")
                        .fontWeight(.medium)
                        .foregroundStyle(.textDefault)
                        .frame(width: 36, height: 36)
                        .cornerRadius(4.0)
                }
                .padding()
                .alert("Enter Album Name", isPresented: $showingSaveAlbumAlert) {
                    TextField("Album Name", text: $newAlbumName)
                    Button("Cancel"){
                        showingSaveAlbumAlert = false
                    }
                    
                    Button("Save") {
                        Task {
                               await saveAllPhotos()
                           }                    }
                    
                }
                
            })
            
        }
    }
    
    
    private func saveAllPhotos() async {
        let albumName = newAlbumName // The name entered by the user
        newAlbumName = "" // Reset for next use
        isSaving = true
        saveProgress = 0.0 // Reset progress
        let totalPhotos = self.vm.album.albumPhotos.count
        
        // Create album and save photos with progress
        do {
            let album = try await createOrFetchAlbum(named: albumName)
            for (index, photo) in self.vm.album.albumPhotos.enumerated() {
                if let url = URL(string: photo.image.replacingOccurrences(of: "/compressed", with: "")) {
                    await saveImageToPhotos(url: url, album: album)
                    DispatchQueue.main.async {
                        self.saveProgress = Float(index + 1) / Float(totalPhotos)
                    }
                }
            }
            DispatchQueue.main.async {
                self.isSaving = false // Update UI after all photos have been saved
            }
        } catch {
            print("Failed to save photos: \(error.localizedDescription)")
            DispatchQueue.main.async {
                self.isSaving = false
                // Handle error (e.g., show an alert to the user)
            }
        }
    }

}

#Preview {
    AlbumView(albumName: "sunsets")
        .environmentObject(ViewModel())
}

func createOrFetchAlbum(named albumName: String) async throws -> PHAssetCollection {
    let fetchOptions = PHFetchOptions()
    fetchOptions.predicate = NSPredicate(format: "title = %@", albumName)
    let collections = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: fetchOptions)
    
    if let existingAlbum = collections.firstObject {
        // Album already exists
        return existingAlbum
    } else {
        // Create new album
        return try await withCheckedThrowingContinuation { continuation in
            var placeholder: PHObjectPlaceholder?
            PHPhotoLibrary.shared().performChanges({
                let albumRequest = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: albumName)
                placeholder = albumRequest.placeholderForCreatedAssetCollection
            }) { success, error in
                if success, let placeholder = placeholder, let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [placeholder.localIdentifier], options: nil).firstObject {
                    continuation.resume(returning: album)
                } else if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(throwing: NSError(domain: "com.PhotoAura.ErrorDomain", code: -1, userInfo: [NSLocalizedDescriptionKey: "Unknown error creating album"]))
                }
            }
        }
    }
}