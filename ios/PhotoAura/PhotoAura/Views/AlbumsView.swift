//
//  AlbumsView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 2/1/24.
//

import SwiftUI
import CachedAsyncImage

struct AlbumsView: View {
    @EnvironmentObject var vm: ViewModel
    init() {
        
        UINavigationBar.appearance().largeTitleTextAttributes = [.font : UIFont(name: "Lato-Bold", size: 36)!]
        
        
    }
    
    let columns = [
        GridItem(.flexible()),
        GridItem(.flexible())
    ]
    
    
    var body: some View {
        NavigationStack{
            ScrollView {
                VStack {
                    
                    ForEach(vm.albums, id: \.self) { album in
                        
                        NavigationLink{
                            AlbumView(slug: album.slug)
//                                .navigationBarBackButtonHidden(true)
                        } label: {
                            ZStack{
                                VStack(alignment: .leading){
                                    
                                    Text(album.albumName)
                                        .font(.custom(Lato, size: 16))
                                        .lineSpacing(24)
                                        .fontWeight(.medium)
                                        .tracking(-0.025)
                                        .foregroundStyle(.textDefault)
                                    
                                    Text("\(album.imageCount) images")
                                        .font(.custom(Lato, size: 16))
                                        .lineSpacing(24)
                                        .fontWeight(.medium)
                                        .tracking(-0.025)
                                        .foregroundStyle(.textDefault.opacity(0.5))
                                    
                                    
                                        .foregroundStyle(.textDefault)
                                    
                                    LazyVGrid(columns: columns, spacing: 20) {
                                        
                                        ForEach(album.albumPhotos, id: \.self) { photo in
                                            
                                            CachedAsyncImage(url: URL(string: photo.image)) { image in
                                                image .resizable()
                                                    .aspectRatio(1.0, contentMode: .fill)
                                                    .cornerRadius(4.0)
                                                
                                            } placeholder: {
                                                ProgressView()
                                            }
                                            
                                            
                                            
                                            
                                        }
                                    }
                                }
                                .padding()
                                
                            }
                            .background(.sidebarDefault)
                            .cornerRadius(4.0)
                            .padding()
                        }
                    }
                    
                    
                    
                    
                    
                }
                .navigationTitle("Albums")
                .onAppear {
                    Task {
                        do {
                            try await vm.getAlbums()
                        } catch {
                            print("Error loading photos")
                        }
                        vm.album = AlbumsModel()

                    }
                }
            }
        }
    }
}

#Preview {
    AlbumsView()
        .environmentObject(ViewModel())
}
