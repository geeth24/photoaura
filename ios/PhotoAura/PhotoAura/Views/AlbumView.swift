//
//  AlbumView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 2/2/24.
//

import SwiftUI
import MasonryStack
import Photos
import PhotosUI
import CachedAsyncImage

struct AlbumView: View {
    @EnvironmentObject var vm: ViewModel
    @State var slug: String
    // State for alert and album name
    @State private var showingSaveAlbumAlert = false
    @State private var newAlbumName = ""
    
    @State private var showingCarousel = false
    @State private var selectedPhotoIndex = 0 // Keep track of the selected photo index
    
    @State private var saveProgress: Float = 0.0
    @State private var isSaving = false
    
    @State private var isPresentingPhotoPicker = false
    @State private var selectedItems: [PhotosPickerItem] = []
    @StateObject private var webSocketManager = WebSocketManager(urlString: "wss://aura.reactiveshots.com/api/ws/")
    
    let dateFormatter = DateFormatter()

   

    
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
                    
                    
                    MasonryVStack(columns: vm.sidebarOpened ? 1 : 2, spacing: 20) {
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
            .photosPicker(isPresented: $isPresentingPhotoPicker, selection: $selectedItems, maxSelectionCount: 0, matching: .images, photoLibrary: .shared()) // 0 for unlimited selection
            .onChange(of: selectedItems) { newItems in
                processSelectedItems(newItems)
            }
            
            .onAppear {
                UIPageControl.appearance().currentPageIndicatorTintColor = .buttonDefault
                UIPageControl.appearance().pageIndicatorTintColor = .buttonDefault.withAlphaComponent(0.2)
                UINavigationBar.appearance().largeTitleTextAttributes = [.font : UIFont(name: "Lato-Bold", size: 36)!]
                
                Task {
                    do {
                        try await vm.getAlbum(slug: slug)
                        newAlbumName = vm.album.albumName
                    } catch {
                        print("Error loading photos")
                    }
                }

            }
            .onDisappear(){
                webSocketManager.disconnect()
            }
            .navigationTitle(vm.album.albumName)
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
                
                if vm.album.upload || vm.getUserDetail()?.id == 0 {
                    Button {
                        isPresentingPhotoPicker = true
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.medium)
                            .foregroundStyle(.textDefault)
                            .frame(width: 36, height: 36)
                            .cornerRadius(4.0)
                    }
                }
                
            })
            
        }
    }
    
    func uploadPhotosData(photosData: [Data], albumName: String, slug: String, userID: Int?) async -> Bool {
        webSocketManager.connect()
        let boundary = "Boundary-\(UUID().uuidString)"
        guard let url = URL(string: "https://aura.reactiveshots.com/api/upload-files/?album_name=\(vm.album.albumName)&slug=\(vm.album.slug)&update=true") else {
            print("Invalid URL")
            return false
        }
        // Set the desired format using hyphens
        dateFormatter.dateFormat = "yyyy-MM-dd-HH-mm-ss"

        // Get the current date and time
        let now = Date()

        // Convert the current date and time to the specified format
        let formattedDate = dateFormatter.string(from: now)
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        let body = NSMutableData()
        
        for (index, photoData) in photosData.enumerated() {
            body.appendString("--\(boundary)\r\n")
            body.appendString("Content-Disposition: form-data; name=\"files\"; filename=\"PhotoAura-iOS-\(slug.replacingOccurrences(of: "/", with: "-"))-\(formattedDate).jpg\"\r\n")
            body.appendString("Content-Type: image/jpeg\r\n\r\n")
            body.append(photoData)
            body.appendString("\r\n")
        }
        
       
        
        body.appendString("--\(boundary)--\r\n")
        request.httpBody = body as Data
        
        do {
            let (_, response) = try await URLSession.shared.upload(for: request, from: body as Data)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                print("Failed to upload photos. Server responded with status code: \(String(describing: (response as? HTTPURLResponse)?.statusCode))")
                return false
            }
            
            // Handle successful upload response
            print("Photos uploaded successfully.")
            webSocketManager.disconnect()

            Task {
                do {
                    try await vm.getAlbum(slug: slug)
                    newAlbumName = vm.album.albumName
                } catch {
                    print("Error loading photos")
                }
            }

            return true
        } catch {
            webSocketManager.disconnect()

            print("Failed to upload photos: \(error.localizedDescription)")
            return false
        }
    }

    
    
    func processSelectedItems(_ items: [PhotosPickerItem])  {
        // Initialize an array to hold the data of all selected photos
        var photosData: [Data] = []
        
        // Group for managing asynchronous tasks
        let group = DispatchGroup()
        
        for item in items {
            group.enter() // Enter the group for each item
            item.loadTransferable(type: Data.self) { result in
                defer { group.leave() } // Ensure to leave the group whether the operation succeeds or fails
                switch result {
                case .success(let data):
                    if let data = data {
                        photosData.append(data)
                    }
                case .failure(let error):
                    print("Error loading image data: \(error.localizedDescription)")
                }
            }
        }
        
        group.notify(queue: .main) {
            // This block is executed once all selected items have been processed
            Task {
                let uploadSuccess = await self.uploadPhotosData(photosData: photosData, albumName: vm.album.albumName, slug: vm.album.slug, userID: vm.getUserDetail()?.id)
                if uploadSuccess {
                    print("All photos uploaded successfully.")
                    // Optionally, perform any UI updates or further processing here
                } else {
                    print("Failed to upload one or more photos.")
                    // Handle upload failure, update UI accordingly
                }
            }
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
    AlbumView(slug: "geeth/ios")
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

extension NSMutableData {
    func appendString(_ string: String) {
        if let data = string.data(using: .utf8) {
            append(data)
        }
    }
}

