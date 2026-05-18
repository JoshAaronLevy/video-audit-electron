# Datatable Updates

The following is a list of updates and changes made to the datatable component.

## Update 1: File Column Changes

1. Rename the "File" column to "File Name".

2. Remove the extension from the file names in the "File Name" column (for the `span title` element). For example, "Roger Federer Greatest Shots.mp4" should be displayed as "Roger Federer Greatest Shots".

3a. Remove the leading path from the displayed path in the "File Name" column (for the `span small` element) up to the folder that the user selected as the root folder to do their audit scan. For example, if the user selected the folder `/Volumes/SanDisk SSD/Videos/Edited` as the root folder for their audit scan, then the displayed path in the table below the file name should start with `Edited/` and not include the leading path of `/Volumes/SanDisk SSD/Videos/`.

3b. Trim the path from the displayed path in the "File Name" column (for the `span small` element) so it shows the path all the way up to the highest level shared directory across files. For example (and in this example, the user selected `/Volumes/SanDisk SSD/Videos/Edited/Sports` as the root folder to scan. So the app will treat `/Sports/` as the root for displaying the path in the datatable). So if there are two videos, one with the file path `/Edited/Sports/Tennis/Wimbledon` and another with the file path `/Edited/Sports/Tennis/US Open`, the displayed path for both videos should be `/Edited/Sports/Tennis`.

### Acceptance Criteria

- The "File" column is renamed to "File Name".
- The root folder of the path in the "File Name" column is determined based on the user's selection and is displayed correctly according to the rules outlined in points 3a and 3b.
  - ***IMPORTANT:*** The changes to the path name are **ONLY** for display purposes in the datatable. The actual file paths used in the code and for any file operations should remain unchanged. And in the video details modal, the file path should also remain unchanged and show the full path.

### Clarifying Questions

1. For point 3b, should the displayed path include ancestor context above the selected scan root exactly like `/Edited/Sports/Tennis`, or should it start at the selected root folder name, like `Sports/Tennis`? Point 3a sounds like the selected folder name should be included, but the 3b example includes `Edited` even though the selected root is `/Volumes/SanDisk SSD/Videos/Edited/Sports`.
**Answer:** It should start at the scan root folder selected before the user gets to refine the folders within that root that they want to include. So when they open the modal to configure sources, and they click the "Choose Folders" button, whatever folder they select in that modal is the root for the datatable path display. So if they select `/Volumes/SanDisk SSD/Videos/Edited` as the root in that modal, then the datatable should display paths starting with `Edited/` and not include any ancestor context above that selected root. So if there are only 2 videos, and both are in `/Volumes/SanDisk SSD/Videos/Edited/Sports/Tennis`, it should show `Edited/Sports/Tennis`.

2. Should the displayed path include a leading slash (`/Edited/Sports/Tennis`) or omit it (`Edited/Sports/Tennis`)? The 3a example omits the leading slash, while the 3b example includes it.
**Answer:** The displayed path should omit the leading slash, so it should be `Edited/Sports/Tennis`.

3. How should display trimming work when the audit has multiple selected folders and/or individually selected files instead of one scan root? Should each row be trimmed relative to the nearest selected folder, relative to the folder-tree root, or relative to the highest shared directory across all visible result rows?
**Answer:** Actually don't worry about this for now. I need to think about it more. For now, show the full path starting at the selected root, up to the file name (without the file name, since that's already above).

4. For the top file-name line, should the `title` attribute continue to show the full original path on hover for traceability, or should it match the extensionless displayed file name? I understand the visible text should be extensionless either way.
**Answer:** It can continue to show the full original path on hover for traceability. So the `span title` element should show the full file name with full path and extension.

## Update 2: Add Column Filters

The following columns should have filters added to them right underneath the column header

- File Name (text filter. Can be file name, path, or both)
- Type (multiselect dropdown filter with options for each file type that is present in the datatable)
- Size (multiselect dropdown filter with options for different size ranges. **NOTE:** Refer to the `video-audit` repo for reference on how to implement the size filter options, as well as the logic for filtering by size range/different range options)
- Duration (multiselect dropdown filter with options for different duration ranges. **NOTE:** Refer to the `video-audit` repo for reference on how to implement the duration filter options, as well as the logic for filtering by duration range/different range options)
- Modified (multiselect dropdown filter with options for different modified date ranges. **NOTE:** This is not in the `video-audit` repo, but you can implement it using the same logic as the size and duration filters. The options for the modified date filter should be: "Last 7 days", "Last 30 days", "Last 90 days", "Last 180 days", "Last 365 days", "More than 365 days ago")
- For the rest of the columns, implement filters the same way the same column filters are implemented in the `video-audit` repo. If a column has a filter in the `video-audit` repo, then implement that same filter type and logic and option groups for that column in the `collie-video` app. If a column does not have a filter in the `video-audit` repo, then use your best judgment (e.g. "Issues" column could probably benefit from a multiselect dropdown filter. But the Actions column probably doesn't need a filter since it only has buttons in it and no actual data to filter by).

### Clarifying Questions

1. The `video-audit` reference table includes a `Status` column/filter, but the current `collie-video` table does not render a Status column. Should I add a Status column to match that reference table, or keep the current column set and only add filters to columns that already exist in `collie-video`?
**Answer:** You do not need to add the status filter at this stage. That was from before we implemented features that would hide rows that were exported to Premiere Pro or "Auto-Fixed".

2. Should the new column filters feed back into the top toolbar's "{count} shown" count and any table-scoped action counts, or is it acceptable for them to filter only the PrimeReact table rows locally? The current `collie-video` app computes that toolbar count before the DataTable gets involved.
**Answer:** For now, it's acceptable for the column filters to filter only the PrimeReact table rows locally and not feed back into the top toolbar's "{count} shown" count. We can consider implementing that feedback loop in a future update if needed.

3. For the current `Issues` column, should the multiselect options be based on the visible badge labels currently rendered in `collie-video` (`Low-res`, `Not 16:9`, `Black borders`, `Error`, `Review`, `OK`), or do you want a different issue taxonomy?
**Answer:** Actually, please remove the `Issues` column entirely. We already have columns for Resolution, Aspect Ratio, and Crop. And the filtering is going to be AND filtering. So if a user selects a duration of 5-10 minutes, which drops the table down from 100 to 20 videos, and then they select the "Low Res" filter option in the Resolution column, then the table will show only the videos that are both 5-10 minutes in duration AND are low resolution. So the Issues column is redundant and not necessary.

4. Should the current `Preview` column get a filter such as `Has thumbnail` / `No thumbnail`, or should Preview and Actions remain unfiltered?
**Answer:** Preview and Actions should remain unfiltered for now. We can consider adding a "Has thumbnail" / "No thumbnail" filter to the Preview column in a future update if we find that users need it.
