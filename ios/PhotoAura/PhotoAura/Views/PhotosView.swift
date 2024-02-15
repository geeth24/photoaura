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
        UINavigationBar.appearance().largeTitleTextAttributes = [.font : UIFont(name: "Lato-Bold", size: 36)!]
        
        
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack {
                    
                    MasonryVStack(columns: vm.sidebarOpened ? 1 : 2, spacing: 20) {
                        ForEach(vm.photos.indices, id: \.self) { index in
                            let photo = vm.photos[index]
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
            .navigationTitle("Photos")
            
            
        }
    }
    
    
}

struct PhotoView: View {
    let photo: AlbumModel
    @State var savedAlert: Bool = false
    @State var deleteAlert: Bool = false

    @EnvironmentObject var vm: ViewModel
    @State var slug: String?

    var body: some View {
        CachedAsyncImage(url: URL(string: photo.image)) { image in
            image
                .resizable()
                .scaledToFit()
            //                .frame(minHeight: 100, maxHeight: .infinity) // Allows for variable height
                .cornerRadius(4.0)
                .contextMenu { // Add context menu
                    Button(action: {
                        // Prepare URL by removing '/compressed'
                        if let modifiedURL = URL(string: photo.image.replacingOccurrences(of: "/compressed", with: "")) {
                            Task {
                                do {
                                    try await saveImageToPhotos(url: modifiedURL)
                                    // Optionally, update UI or state to reflect the successful save
                                    savedAlert = true
                                } catch {
                                    print("Failed to save image: \(error.localizedDescription)")
                                    // Handle error, such as showing an alert to the user
                                }
                            }
                        }
                    }) {
                        Label("Save to Photos", systemImage: "square.and.arrow.down")
                    }
                    
                    if (slug != nil) {
                        Button(action: {
                            Task {
                                do {
                                    try await vm.deletePhoto(slug: slug!, photoName: photo.fileMetadata.fileName)
                                    
                                    // Optionally, update UI or state to reflect the successful save
//                                    deleteAlert = true
                                    
                                    try await vm.getAlbum(slug: slug!)
                                } catch {
                                    print("Failed to delete image: \(error.localizedDescription)")
                                    // Handle error, such as showing an alert to the user
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
            
                .foregroundStyle(.sidebarDefault)
        }
        .alert("Photo Saved", isPresented: $savedAlert){
            Button("Ok", role: .cancel){
                savedAlert = false
            }
        }
        .alert("Photo Deleted", isPresented: $deleteAlert){
            Button("Ok", role: .cancel){
                deleteAlert = false
            }
        }
    }
}

struct PhotoCarouselView: View {
    var photos: [AlbumModel]
    @Binding var selectedIndex: Int
    
    
    @State var savedAlert: Bool = false
    var body: some View {
        NavigationStack{
            TabView(selection: $selectedIndex) {
                ForEach(photos.indices, id: \.self) { index in
                    if let url = URL(string: photos[index].image) {
                        VStack{
                            CachedAsyncImage(url: url) { image in
                                image.resizable().scaledToFit()
                            } placeholder: {
                                ProgressView()
                            }
                            
                        }
                        
                        
                        
                    }
                }
            }
            .toolbar(content: {
                Button(action: {
                    // Prepare URL by removing '/compressed'
                    if let modifiedURL = URL(string: photos[selectedIndex].image.replacingOccurrences(of: "/compressed", with: "")) {
                        Task {
                            do {
                                try await saveImageToPhotos(url: modifiedURL)
                               savedAlert = true
                            } catch {
                                print("Failed to save image: \(error.localizedDescription)")
                                // Handle error, such as showing an alert to the user
                            }
                        }
                    }
                }) {
                    Image(systemName: "square.and.arrow.down")
                        .fontWeight(.medium)
                        .foregroundStyle(.textDefault)
                        .frame(width: 36, height: 36)
                        .cornerRadius(4.0)
                    
                }
            })
            .padding()
            HStack{
                Button{
                    withAnimation {
                        if selectedIndex != 0 {
                            selectedIndex -= 1
                        }
                    }
                } label: {
                    Image(systemName: "arrow.left")
                        .fontWeight(.medium)
                        .foregroundStyle(selectedIndex !=  0
                                         ? .textDefault : .textDefault.opacity(0.3))                        .frame(width: 36, height: 36)
                        .cornerRadius(4.0)
                }
                .disabled(selectedIndex == 0)
                
                Button{
                    withAnimation {
                        
                        if selectedIndex != photos.count-1 {
                            selectedIndex += 1
                        }
                    }
                } label: {
                    Image(systemName: "arrow.right")
                        .fontWeight(.medium)
                        .foregroundStyle(selectedIndex != photos.count-1 ? .textDefault : .textDefault.opacity(0.3))
                        .frame(width: 36, height: 36)
                        .cornerRadius(4.0)
                }
                .disabled(selectedIndex == photos.count-1)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
        .background(Color(UIColor.systemBackground))
        .alert("Photo Saved", isPresented: $savedAlert){
            Button("Ok", role: .cancel){
                savedAlert = false
            }
        }
    }
}

#Preview {
    PhotosView()
        .environmentObject(ViewModel())
}

func saveImageToPhotos(url: URL) async throws {
    // Download image data
    let (data, _) = try await URLSession.shared.data(from: url)

    // Save image data to Photos library
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
        print("Successfully saved image to Photos library in album \(album.localizedTitle ?? "")")
    } catch {
        print("Error saving image to Photos library: \(error.localizedDescription)")
    }
}
