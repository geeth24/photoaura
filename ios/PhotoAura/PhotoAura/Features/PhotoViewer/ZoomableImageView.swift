//
//  ZoomableImageView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 8/25/26.
//
//  Zoom/pan built on UIScrollView rather than MagnificationGesture. SwiftUI's
//  gesture zooms from the centre with no way to pan, which is why pinching felt
//  stuck on one point; a scroll view gives anchored pinch, panning, bounds and
//  double-tap-to-point the way Photos does it.
//

import SwiftUI
import UIKit

struct ZoomableImageView<Content: View>: UIViewRepresentable {
    /// identity of the photo on this page; rebuilding the hosted view for the
    /// same photo restarts its image load and makes the screen flash
    var photoID: String
    var maxScale: CGFloat = 6
    /// fires only when zoomed state flips, never on every delegate tick — a
    /// per-frame state write re-renders the pager and cancels the zoom transition
    var onZoomedChange: ((Bool) -> Void)? = nil
    @ViewBuilder var content: () -> Content

    func makeUIView(context: Context) -> UIScrollView {
        let scroll = UIScrollView()
        scroll.delegate = context.coordinator
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = maxScale
        scroll.bouncesZoom = true
        scroll.showsHorizontalScrollIndicator = false
        scroll.showsVerticalScrollIndicator = false
        scroll.backgroundColor = .clear
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.decelerationRate = .fast
        // at 1x let the pager have the horizontal swipe
        scroll.isScrollEnabled = false

        let host = context.coordinator.host
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            host.view.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor),
            host.view.heightAnchor.constraint(equalTo: scroll.frameLayoutGuide.heightAnchor),
        ])

        let doubleTap = UITapGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleDoubleTap(_:))
        )
        doubleTap.numberOfTapsRequired = 2
        scroll.addGestureRecognizer(doubleTap)
        context.coordinator.scrollView = scroll
        return scroll
    }

    func updateUIView(_ uiView: UIScrollView, context: Context) {
        context.coordinator.onZoomedChange = onZoomedChange
        // only swap content when the page is actually showing a different photo
        guard context.coordinator.photoID != photoID else { return }
        context.coordinator.photoID = photoID
        context.coordinator.host.rootView = content()
        uiView.setZoomScale(1, animated: false)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(host: UIHostingController(rootView: content()), photoID: photoID)
    }

    final class Coordinator: NSObject, UIScrollViewDelegate {
        let host: UIHostingController<Content>
        weak var scrollView: UIScrollView?
        var onZoomedChange: ((Bool) -> Void)?
        var photoID: String
        private var wasZoomed = false

        init(host: UIHostingController<Content>, photoID: String) {
            self.host = host
            self.photoID = photoID
            super.init()
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? { host.view }

        func scrollViewDidZoom(_ scrollView: UIScrollView) {
            // keep the image centred while it's smaller than the viewport
            let x = max(0, (scrollView.bounds.width - scrollView.contentSize.width) / 2)
            let y = max(0, (scrollView.bounds.height - scrollView.contentSize.height) / 2)
            scrollView.contentInset = UIEdgeInsets(top: y, left: x, bottom: y, right: x)
            let zoomed = scrollView.zoomScale > 1.01
            scrollView.isScrollEnabled = zoomed
            guard zoomed != wasZoomed else { return }
            wasZoomed = zoomed
            onZoomedChange?(zoomed)
        }

        @objc func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
            guard let scroll = scrollView else { return }
            if scroll.zoomScale > 1.01 {
                scroll.setZoomScale(1, animated: true)
            } else {
                // zoom toward the point that was tapped, not the middle
                let point = gesture.location(in: host.view)
                let target: CGFloat = 3
                let size = CGSize(
                    width: scroll.bounds.width / target,
                    height: scroll.bounds.height / target
                )
                scroll.zoom(
                    to: CGRect(
                        x: point.x - size.width / 2,
                        y: point.y - size.height / 2,
                        width: size.width,
                        height: size.height
                    ),
                    animated: true
                )
            }
        }

        func reset() {
            scrollView?.setZoomScale(1, animated: false)
        }
    }
}
