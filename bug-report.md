# Bug Report

The following bugs/UX issues have been identified in the app.

**IMPORTANT NOTE:**

I added the `video-audit` repo to this workspace to assist with these bugs. It is the old legacy web app that we built before this electron version `collie-video`. The `collie-video` app is essentially a desktop version of the `video-audit` web app, but with a lot of improvements and new features. However, there are still some features that were working in the `video-audit` web app that are not yet fully implemented or working in the `collie-video` electron app. So please carefully reference the `video-audit` repo when investigating and fixing these issues, as it will likely provide insight into how certain features were implemented in the web version and how they can be implemented in the electron version.

However, please also note that the `collie-video` app is not just a copy of the `video-audit` web app. There are some key differences in how certain features are implemented, and there are also new features in `collie-video` that were not present in `video-audit`. So while the `video-audit` repo can be a helpful reference, please also use your judgment and creativity to implement solutions that fit well with the overall design and functionality of the `collie-video` app. And remain consistent with the existing codebase and design patterns in `collie-video` when implementing fixes and new features.

Finally, do NOT make any changes to the `video-audit` repo. ALL code changes and implementations should be made in the `collie-video` repo. The `video-audit` repo is just for reference and should not be modified in any way.

## 1 - No Easy Clear Cache Option for Users

Currently, there's no button on the table view that allows users to clear the cache for the existing videos on the table. Please add a button that allows users to easily clear the cache for the videos on the table, so that if they want to run a fresh scan, they can do so without any issues. This button should be easily accessible and clearly labeled, so that users can find it and use it without any confusion. When clicked, the table will reset to its default state, with no videos loaded, and users can then run a new scan to populate the table with fresh data. This will improve the user experience and make it easier for users to manage their scans and data in the app.

### Clarifying Questions

- Should this clear only the saved/current audit table data, or should it also delete the generated media-preview cache from disk, including thumbnails and preview clips?
  **Answer:** This should clear both the saved/current audit table data and the generated media-preview cache from disk, including thumbnails and preview clips.
- After clearing, should selected sources and the configured output folder remain available, or should the app return to the fully empty initial state?
  **Answer:** After clearing, it should return to the fully empty initial state, meaning that selected sources and the configured output folder should also be cleared and reset to their default states.
    - NOTE: I plan on implementing a feature that allows users to view and manage their scan history, including past scans and their results. So if it doesn't add too much complexity, I would like it if you leveraged whatever method(s) we use for storing data and state (like the Electron equivalent of localStorage or whatever we're using) to save metadata about each scan, such as the date and time it was run, the sources that were scanned, the output folder used, and a summary of the results (like how many videos were flagged). This way, users will be able to view their scan history and easily re-run a previous scan if they want to, which will run the scan with all the same parameters and options as the original scan, but with fresh results. Do NOT implement the scan history feature yet. But please try to implement the functionality so when a user clicks "Clear Cache", it saves the metadata about that scan in a way that can be easily accessed and displayed in the future when I implement the scan history feature before clearing everything. Finally, I know I mentioned using whatever we currently use for storing data and state in the app, but if there's a different solution that's better, please implement that instead.

## 2 - Premiere Pro Bridge Not Fully Set Up

When I open the app, if Premiere Pro is not running, there's a warning tag that says "Premiere attention". But when I open Premiere Pro, the warning tag doesn't disappear, even on app refresh, and even on rebuild and reload.
  - NOTE: When I click the button that says "Premiere Bridge disconnected", it opens the modal for the settings, and I notice it's looking for the bridge in the wrong directory. I added the old legacy web app repo `video-audit` to this workspace that had this feature working in the web version. Please reference how the bridge is being built and where it's being built in that project to get an idea of how to maybe implement it in this one. The main files/folders you'll find it in are `premiere-uxp`, `shared/premiereBridge.cjs`, and `shared/premiereBridge.schema.md` (although there might be other code that references the bridge in other files, so feel free to search for it in the whole project).

### Clarifying Questions

- Should `collie-video` connect to the existing legacy Video Audit UXP bridge, which uses `video-audit-premiere-bridge` and `~/VideoAudit/premiere-bridge`, or should we add/update a Collie Video UXP bridge that uses `collie-video-premiere-bridge` and `~/CollieVideo/premiere-bridge`?
  **Answer:** We should add/update a Collie Video UXP bridge that uses `collie-video-premiere-bridge` and `~/CollieVideo/premiere-bridge`.
- In the current settings/diagnostics view, what bridge directory is shown as connected or incorrect, and what bridge directory did the working Premiere plugin actually select inside Premiere Pro?
  **Answer:** The current settings/diagnostics view shows the bridge directory as `/Users/joshlevy/CollieVideo/premiere-bridge`, which is incorrect.
    - NOTE: If possible, let's have a folder in `'/Users/joshlevy/Library/Application Support'` that the app can use to store necessary files and data for the Premiere bridge, instead of using the root user directory. This will be a more standard and appropriate location for storing application data on a Mac, and it will also help to avoid any potential issues with permissions or cluttering the user's root directory. So please implement the Premiere bridge in a way that will create what's necessary to store the bridge in that directory, and that it looks for the necessary files in `'/Users/joshlevy/Library/Application Support/CollieVideo/premiere-bridge'` instead of `'/Users/joshlevy/CollieVideo/premiere-bridge'`. And please make sure to update any relevant code and documentation to reflect this change in the directory structure for the Premiere bridge.
    - NOTE: I just realized some functionality we can add now that this is an Electron app. If it's not too difficult to add, I would like to add a button somewhere easy to see where a user can click and the app will automatically open Premiere Pro, as well as the Adobe UXP Developer Tools app, which is necessary for the Premiere bridge to work. This will make it easier for users to set up the Premiere bridge and get it working without having to manually open those apps themselves. So please implement this button in a way that it opens both Premiere Pro and the Adobe UXP Developer Tools app when clicked.

## 3 - Audit Scan Modal Doesn't Automatically Close When Scan Starts

When I run an audit scan for selected videos, the scan works just fine. But the modal to select files doesn't automatically close once the scan starts. I have to manually close it, which is a bit of a UX issue. It would be better if the modal automatically closed once the scan starts, so that users don't have to take an extra step to close it.

### Clarifying Questions

N/A

## 4 - Thumbnails Don't Load for Flagged Videos on Datatable

When flagged videos get loaded in the app and on the datatable, I can see the checkbox for "Thumbnails" that shows or hides the thumbnails for the videos on the table. However, the thumbnails don't load for the flagged videos, and there's nowhere to fetch the thumbnails. Once again, please carefully reference the old legacy web app repo `video-audit` to see how the thumbnails were being fetched and displayed in that version, and implement a similar solution in `collie-video`.
  - NOTE: Since the audit scan in this electron app is much faster than the web version, please have the scan perform the function of fetching the thumbnails for the flagged videos as soon as it identifies them, so that by the time the scan is done, the thumbnails are already fetched and can be displayed on the datatable without any additional steps needed (since the web version was slower, we had to implement a separate button to manually fetch thumbnails for selected videos). The video clip functionality in the details modal works perfectly and shouldn't be modified. But I should be able to see the thumbnail for a flagged video on the datatable when the scan is complete.
  - NOTE: The initial scan should only fetch a single thumbnail for each flagged video, which can be displayed on the datatable. But in the details modal, there needs to be a button that users can click to "Get Fresh Thumbnails". This button should invoke function(s) that get a series of images from random points of the video (in case the default thumbnail wasn't a good one). In the web version (`video-audit`), this feature existed, and it would fetch thumbnails based on the length of a video, meaning if it was under 5 minutes, it was a certain number of thumbnails. If it was 5-10 minutes, it was a hugher number of thumbnails, so on and so forth. And like in `video-audit`, the thumbnails should be a carousel that allows users to scroll through all the thumbnails for the flagged video clip. So please carefully review `video-audit` - this feature is likely implemented in both the front and backend of the site, and possibly across multiple files in each (although I'm not sure. It could be one file in each or many) - and implement the same functionality in `collie-video`.
  - NOTE: The thumbnails checkbox option that shows or hides the thumbnails on the datatable is unnecessary. I will always want to see the thumbnails for the flagged videos on the datatable, so please remove that checkbox and make it so that the thumbnails are always visible for flagged videos on the datatable. There should be no option anywhere to hide the thumbnails or even to not include them in the scan. It should be part of the array of data that gets loaded on the datatable.

### Clarifying Questions

N/A

## 5 - IMPORTANT: Users Cannot Run a Scan on a Selected Folder of Videos

THIS IS AN ONGOING ISSUE. We've tried fixing it a couple times with no success. The issue is, when I open the audit modal (via the "Select folders" button), then click "Choose folders", it lets me select a root folder, then populates the file tree with all the folders in that root, along with a video count and a disk size. However, when I check the boxes next to the folders I want to scan, the scan button label changes from "Select folders to continue" to "Use selected folders". However, the button state is disabled. I cannot click the button to start the scan, which means I cannot run a scan on a selected folder of videos. This is a critical issue that needs to be resolved as soon as possible, as it's a key feature of the app. Please investigate this issue and implement a fix that allows users to select folders and run scans on them without any issues.

### Clarifying Questions

- Does the disabled `Use selected folders` state happen after selecting the root folder too, or only after selecting child folders?
  **Answer:** The disabled state occurs even when selecting the root folder. So it happens no matter which folders are selected, including the root folder.
- When the button is disabled, does the dialog still show any active scan/progress state, or does it look fully finished and idle?
  **Answer:** When the button is disabled, the dialog looks fully finished and idle. There's no indication of an active scan or progress state that I am able to see.
