/* Original allstudio helper. Directory-relative operations never follow symlinks.
 * The granting parent must pass its pinned root directory as descriptor 3.
 * Protocol: argv read|write root relative; writes receive length\nbytes twice
 * (expected and replacement). READY precedes input; PREPARED waits for C to
 * commit. Output ends with OK [mode length]\n[bytes] or ERR reason.
 */
#define _DARWIN_C_SOURCE
#define _GNU_SOURCE
#include <errno.h>
#include <dirent.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/random.h>
#include <sys/stat.h>
#include <unistd.h>
#if defined(__linux__)
#include <linux/fs.h>
#include <sys/syscall.h>
#endif

#define LIMIT (1024 * 1024)
static int parent_fd = -1;
static char temp_name[80];
static int published;
static int owns_temp;
static struct stat owned_temp;
static void fail(const char *reason) {
  struct stat visible;
  if (owns_temp && parent_fd >= 0 && temp_name[0] &&
      !fstatat(parent_fd, temp_name, &visible, AT_SYMLINK_NOFOLLOW) &&
      visible.st_dev == owned_temp.st_dev && visible.st_ino == owned_temp.st_ino)
    unlinkat(parent_fd, temp_name, 0);
  printf("ERR %s\n", published ? "commit-uncertain" : reason);
  exit(1);
}
static char *receive(size_t *length) {
  char header[32], *end;
  if (!fgets(header, sizeof(header), stdin)) fail("invalid-request");
  errno = 0;
  unsigned long size = strtoul(header, &end, 10);
  if (errno || *end != '\n' || end == header || size > LIMIT) fail("invalid-request");
  char *bytes = malloc(size + 1);
  if (!bytes || fread(bytes, 1, size, stdin) != size) fail("invalid-request");
  *length = size;
  return bytes;
}
static char *read_source(int fd, size_t *length, struct stat *metadata) {
  if (fstat(fd, metadata) || !S_ISREG(metadata->st_mode) || metadata->st_nlink != 1 ||
      metadata->st_size < 0 || metadata->st_size > LIMIT) fail("path-rejected");
  *length = (size_t)metadata->st_size;
  char *bytes = malloc(*length + 1);
  if (!bytes || lseek(fd, 0, SEEK_SET) < 0) fail("read-failed");
  size_t offset = 0;
  while (offset < *length) {
    ssize_t count = read(fd, bytes + offset, *length - offset);
    if (count <= 0) fail("read-failed");
    offset += (size_t)count;
  }
  char extra;
  if (read(fd, &extra, 1) != 0) fail("stale-file");
  return bytes;
}
static int same_inode(const struct stat *a, const struct stat *b) {
  return a->st_dev == b->st_dev && a->st_ino == b->st_ino;
}
static void verify(int fd, const char *name, const struct stat *original,
                   const char *expected, size_t expected_size) {
  struct stat entry, current;
  if (fstatat(parent_fd, name, &entry, AT_SYMLINK_NOFOLLOW) ||
      !S_ISREG(entry.st_mode) || entry.st_nlink != 1 ||
      (entry.st_mode & 07777) != (original->st_mode & 07777) || !same_inode(original, &entry)) fail("stale-file");
  size_t size;
  char *bytes = read_source(fd, &size, &current);
  if (!same_inode(original, &current) ||
      (current.st_mode & 07777) != (original->st_mode & 07777) || size != expected_size || memcmp(bytes, expected, size)) fail("stale-file");
  free(bytes);
}
static void verify_parent(const char *root, const char *relative) {
  (void)root;
  int current = dup(3);
  if (current < 0) fail("path-rejected");
  char *path = strdup(relative), *part = path;
  if (!path) fail("read-failed");
  char *slash;
  while ((slash = strchr(part, '/'))) {
    *slash = '\0';
    int next = openat(current, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    close(current);
    if (next < 0) fail("path-rejected");
    current = next;
    part = slash + 1;
  }
  struct stat original, visible;
  if (fstat(parent_fd, &original) || fstat(current, &visible) || !same_inode(&original, &visible)) fail("path-rejected");
  close(current);
  free(path);
}
static unsigned visited, listed;
static int audit_source_name(const char *name) {
  const char *extension = strrchr(name, '.');
  const char *extensions[] = { ".tsx", ".jsx", ".ts", ".js", ".mjs", ".cjs", NULL };
  for (unsigned i = 0; extension && extensions[i]; ++i) if (!strcmp(extension, extensions[i])) return 1;
  return 0;
}
static int style_name(const char *name) {
  if (!strncmp(name, "postcss.config.", 15) || !strncmp(name, ".postcssrc", 10) || !strncmp(name, "tailwind.config.", 16) || !strncmp(name, "babel.config.", 13) || !strncmp(name, ".babelrc", 8) || !strcmp(name, ".swcrc")) return 1;
  const char *extension = strrchr(name, '.');
  const char *styles[] = { ".css", ".scss", ".sass", ".less", ".pcss", ".postcss", ".styl", ".stylus", NULL };
  for (unsigned i = 0; extension && styles[i]; ++i) if (!strcasecmp(extension, styles[i])) return 1;
  return 0;
}
static int asset_name(const char *name) {
  const char *extension = strrchr(name, '.');
  const char *extensions[] = { ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", NULL };
  for (unsigned i = 0; extension && extensions[i]; ++i) if (!strcasecmp(extension, extensions[i])) return 1;
  return 0;
}
static int hex_string(const char *value, size_t length) {
  for (size_t i = 0; i < length; ++i) {
    const char c = value[i];
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return 0;
  }
  return 1;
}
static int thumbnail_name(const char *name, int allow_temp) {
  size_t length = strlen(name);
  if (length == 68 && hex_string(name, 64) && !strcmp(name + 64, ".jpg")) return 1;
  if (!allow_temp) return 0;
  if (length == 31 && !strncmp(name, ".allstudio-", 11) &&
      hex_string(name + 11, 16) && !strcmp(name + 27, ".tmp")) return 1;
  if (length < 91 || !hex_string(name, 64) || strncmp(name + 64, ".jpg.", 5)) return 0;
  const char *part = name + 69;
  const char *digits = part;
  while (*part >= '0' && *part <= '9') ++part;
  if (part == digits || *part++ != '.') return 0;
  return hex_string(part, 16) && !strcmp(part + 16, ".tmp");
}
static int thumbnail_path(const char *path, int allow_temp) {
  return !strncmp(path, "thumbnails/", 11) && thumbnail_name(path + 11, allow_temp);
}
static int open_thumbnail_directory(int create) {
  int directory = openat(3, "thumbnails", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (directory < 0 && create && errno == ENOENT) {
    if (mkdirat(3, "thumbnails", 0700) && errno != EEXIST) fail("write-failed");
    directory = openat(3, "thumbnails", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  }
  return directory;
}
static unsigned parse_retained_ids(const char *input, size_t length,
                                   char ids[100][65]) {
  if (length > 100 * 65) fail("invalid-request");
  size_t offset = 0;
  unsigned count = 0;
  while (offset < length) {
    if (count >= 100 || length - offset < 64 || !hex_string(input + offset, 64))
      fail("invalid-request");
    memcpy(ids[count], input + offset, 64);
    ids[count][64] = '\0';
    ++count;
    offset += 64;
    if (offset < length && (input[offset++] != '\n' || offset == length))
      fail("invalid-request");
  }
  return count;
}
static int retained_thumbnail(const char *name, char ids[100][65],
                              unsigned count) {
  if (strlen(name) != 68 || !hex_string(name, 64) || strcmp(name + 64, ".jpg"))
    return 0;
  for (unsigned i = 0; i < count; ++i)
    if (!memcmp(name, ids[i], 64)) return 1;
  return 0;
}
static void prune_thumbnail_directory(int directory, char ids[100][65],
                                      unsigned id_count) {
  DIR *stream = fdopendir(dup(directory));
  if (!stream) fail("read-failed");
  unsigned count = 0;
  struct dirent *entry;
  while ((entry = readdir(stream))) {
    if (!strcmp(entry->d_name, ".") || !strcmp(entry->d_name, "..")) continue;
    if (++count > 100000) fail("scan-limit");
    if (!thumbnail_name(entry->d_name, 1)) continue;
    struct stat info;
    if (fstatat(directory, entry->d_name, &info, AT_SYMLINK_NOFOLLOW))
      fail("read-failed");
    if (S_ISDIR(info.st_mode)) fail("path-rejected");
    if (!S_ISREG(info.st_mode) && !S_ISLNK(info.st_mode)) continue;
    if (S_ISREG(info.st_mode) && info.st_nlink != 1) fail("path-rejected");
    if (S_ISREG(info.st_mode) && info.st_size >= 4 && info.st_size <= 96 * 1024 &&
        retained_thumbnail(entry->d_name, ids, id_count)) continue;
    if (unlinkat(directory, entry->d_name, 0)) fail("write-failed");
  }
  closedir(stream);
  if (fsync(directory)) fail("write-failed");
}
static void remove_thumbnail(const char *path) {
  if (!thumbnail_path(path, 1)) fail("path-rejected");
  int directory = open_thumbnail_directory(0);
  if (directory < 0 && errno == ENOENT) { puts("OK"); return; }
  if (directory < 0) fail("path-rejected");
  const char *name = path + 11;
  struct stat info;
  if (fstatat(directory, name, &info, AT_SYMLINK_NOFOLLOW)) {
    if (errno == ENOENT) { close(directory); puts("OK"); return; }
    fail("path-rejected");
  }
  if (S_ISDIR(info.st_mode) || (S_ISREG(info.st_mode) && info.st_nlink != 1) ||
      (!S_ISREG(info.st_mode) && !S_ISLNK(info.st_mode))) fail("path-rejected");
  if (unlinkat(directory, name, 0) || fsync(directory)) fail("write-failed");
  close(directory);
  puts("OK");
}
static void list_source(int directory, const char *prefix, unsigned depth, int styles) {
  if (depth > 32) fail("scan-limit");
  DIR *stream = fdopendir(dup(directory));
  if (!stream) fail("read-failed");
  struct dirent *entry;
  while ((entry = readdir(stream))) {
    if (!strcmp(entry->d_name, ".") || !strcmp(entry->d_name, "..")) continue;
    if (++visited > 10000) fail("scan-limit");
    if (!strcmp(entry->d_name, "node_modules") || !strcmp(entry->d_name, ".git") || !strcmp(entry->d_name, ".next")) continue;
    char relative[1025];
    int length = snprintf(relative, sizeof(relative), "%s%s%s", prefix, *prefix ? "/" : "", entry->d_name);
    if (length < 0 || (size_t)length >= sizeof(relative)) {
      if (styles) fail("scan-limit");
      continue;
    }
    int unsafe_asset_path = 0;
    if (styles == 3) for (const unsigned char *p = (const unsigned char *)relative; *p; ++p)
      if (*p < 32 || *p == 127 || strchr("\\:%?#", *p)) unsafe_asset_path = 1;
    struct stat info;
    if (fstatat(directory, entry->d_name, &info, AT_SYMLINK_NOFOLLOW)) {
      if (styles) fail("read-failed");
      continue;
    }
    if (styles && S_ISLNK(info.st_mode)) fail("path-rejected");
    if (unsafe_asset_path) continue;
    if (S_ISDIR(info.st_mode)) {
      int child = openat(directory, entry->d_name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
      if (child >= 0) { list_source(child, relative, depth + 1, styles); close(child); }
      else if (styles) fail("path-rejected");
    } else if (styles == 3 && asset_name(entry->d_name)) {
      if (!S_ISREG(info.st_mode) || info.st_nlink != 1 || info.st_size < 0 || (unsigned long long)info.st_size > 9007199254740991ULL) fail("path-rejected");
      if (++listed > 500) fail("scan-limit");
      printf("%d %llu\n", length, (unsigned long long)info.st_size);
      if (fwrite(relative, 1, (size_t)length, stdout) != (size_t)length) fail("read-failed");
    } else if ((styles == 1 && style_name(entry->d_name)) || (styles == 2 && audit_source_name(entry->d_name))) {
      if (!S_ISREG(info.st_mode) || info.st_nlink != 1 || info.st_size < 0 || info.st_size > LIMIT) fail("path-rejected");
      if (++listed > 1000) fail("scan-limit");
      printf("%d\n", length);
      if (fwrite(relative, 1, (size_t)length, stdout) != (size_t)length) fail("read-failed");
    } else if (!styles && S_ISREG(info.st_mode) && info.st_nlink == 1 && info.st_size <= LIMIT && length >= 9 &&
               (!strcmp(relative + length - 4, ".tsx") || !strcmp(relative + length - 4, ".jsx"))) {
      if (++listed > 1000) fail("scan-limit");
      printf("%d\n", length);
      if (fwrite(relative, 1, (size_t)length, stdout) != (size_t)length) fail("read-failed");
    }
  }
  closedir(stream);
}
static int configuration(const char *path) {
  return !strcmp(path, "next.config.ts") || !strcmp(path, "next.config.js") || !strcmp(path, "next.config.mjs");
}
static int readable_root(const char *path) {
  const char *names[] = { "package.json", "bun.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsconfig.json", "jsconfig.json", "next.config.allstudio-original.ts", "next.config.allstudio-original.js", "next.config.allstudio-original.mjs", "postcss.config.js", "postcss.config.mjs", "postcss.config.cjs", "tailwind.config.ts", "tailwind.config.js", "tailwind.config.cjs", "postcss.config.ts", "babel.config.js", "babel.config.cjs", "babel.config.mjs", ".babelrc", ".babelrc.json", ".swcrc", NULL };
  for (unsigned i = 0; names[i]; ++i) if (!strcmp(path, names[i])) return 1;
  return configuration(path);
}
int main(int argc, char **argv) {
  if (argc != 4 || (strcmp(argv[1], "read") && strcmp(argv[1], "write") && strcmp(argv[1], "list") && strcmp(argv[1], "list-assets") && strcmp(argv[1], "list-styles") && strcmp(argv[1], "list-audit-sources") && strcmp(argv[1], "read-audit-source") && strcmp(argv[1], "read-css") && strcmp(argv[1], "backup") && strcmp(argv[1], "create") && strcmp(argv[1], "prune-thumbnails") && strcmp(argv[1], "read-thumbnail") && strcmp(argv[1], "write-thumbnail") && strcmp(argv[1], "create-thumbnail") && strcmp(argv[1], "remove-thumbnail"))) fail("invalid-request");
  const char *root = argv[2], *relative = argv[3];
  size_t length = strlen(relative);
  int listing = !strcmp(argv[1], "list") && !strcmp(relative, "src");
  int asset_listing = !strcmp(argv[1], "list-assets") && !strcmp(relative, "public");
  int style_listing = !strcmp(argv[1], "list-styles") && !strcmp(relative, "src");
  int audit_listing = !strcmp(argv[1], "list-audit-sources") && !strcmp(relative, "src");
  int thumbnail_prune = !strcmp(argv[1], "prune-thumbnails") && !strcmp(relative, "thumbnails");
  int thumbnail_read = !strcmp(argv[1], "read-thumbnail") && thumbnail_path(relative, 0);
  int thumbnail_write = !strcmp(argv[1], "write-thumbnail") && thumbnail_path(relative, 0);
  int thumbnail_create = !strcmp(argv[1], "create-thumbnail") && thumbnail_path(relative, 0);
  int thumbnail_remove = !strcmp(argv[1], "remove-thumbnail") && thumbnail_path(relative, 1);
  int audit_read = !strcmp(argv[1], "read-audit-source") && length <= 1024 && length >= 7 && !strncmp(relative, "src/", 4) && !strchr(relative, '\\') && !strchr(relative, ':') && audit_source_name(relative);
  int css_read = !strcmp(argv[1], "read-css") && length <= 1024 && length >= 8 && !strncmp(relative, "src/", 4) &&
      !strchr(relative, '\\') && !strchr(relative, ':') && !strcasecmp(relative + length - 4, ".css");
  int creating = (!strcmp(argv[1], "create") && configuration(relative)) || thumbnail_create;
  int backing = !strcmp(argv[1], "backup") && configuration(relative);
  int config_io = configuration(relative) && (!strcmp(argv[1], "read") || !strcmp(argv[1], "write"));
  int metadata_read = !strcmp(argv[1], "read") && readable_root(relative);
  int source_path = (!strcmp(argv[1], "read") || !strcmp(argv[1], "write")) && length <= 1024 && length >= 9 && !strncmp(relative, "src/", 4) &&
      !strchr(relative, '\\') && !strchr(relative, ':') &&
      (!strcmp(relative + length - 4, ".tsx") || !strcmp(relative + length - 4, ".jsx"));
  if (!listing && !asset_listing && !style_listing && !audit_listing && !thumbnail_prune && !thumbnail_read && !thumbnail_write && !thumbnail_create && !thumbnail_remove && !audit_read && !css_read && !creating && !backing && !config_io && !metadata_read && !source_path) fail("path-rejected");
  if ((!strcmp(argv[1], "create") && !creating) || (!strcmp(argv[1], "backup") && !backing)) fail("path-rejected");
  char *canonical = realpath(root, NULL);
  if (!canonical || strcmp(canonical, root)) fail("path-rejected");
  free(canonical);
  struct stat granted, visible;
  if (fstat(3, &granted) || !S_ISDIR(granted.st_mode) || stat(root, &visible) || !same_inode(&granted, &visible)) fail("path-rejected");
  if (thumbnail_prune) {
    int directory = open_thumbnail_directory(0);
    if (directory < 0 && errno != ENOENT) fail("path-rejected");
    puts("READY");
    fflush(stdout);
    size_t expected_size, ids_size;
    char *expected = receive(&expected_size);
    char *ids_input = receive(&ids_size);
    if (expected_size != 0) fail("invalid-request");
    char retained_ids[100][65];
    unsigned retained_count = parse_retained_ids(ids_input, ids_size, retained_ids);
    puts("PREPARED");
    fflush(stdout);
    if (getchar() != 'C') fail("write-failed");
    if (directory >= 0) {
      prune_thumbnail_directory(directory, retained_ids, retained_count);
      close(directory);
    }
    free(expected);
    free(ids_input);
    puts("OK");
    return 0;
  }
  if (thumbnail_remove) { remove_thumbnail(relative); return 0; }
  if (thumbnail_write || thumbnail_create) {
    int directory = open_thumbnail_directory(1);
    if (directory < 0) fail("path-rejected");
    close(directory);
  }
  if (listing || asset_listing || style_listing || audit_listing) {
    int source = openat(3, style_listing ? "." : asset_listing ? "public" : "src", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (source < 0 && asset_listing && errno == ENOENT) { puts("OK"); return 0; }
    if (source < 0) fail("path-rejected");
    puts("OK");
    list_source(source, style_listing ? "" : asset_listing ? "public" : "src", 0, asset_listing ? 3 : audit_listing ? 2 : style_listing);
    return 0;
  }
  parent_fd = dup(3);
  if (parent_fd < 0) fail("path-rejected");
  char *path = strdup(relative), *component = path;
  if (!path) fail("read-failed");
  for (;;) {
    char *slash = strchr(component, '/');
    if (slash) *slash = '\0';
    if (!*component || !strcmp(component, ".") || !strcmp(component, "..")) fail("path-rejected");
    if (!slash) break;
    int next = openat(parent_fd, component, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) fail("path-rejected");
    close(parent_fd);
    parent_fd = next;
    component = slash + 1;
  }
  int fd = -1;
  struct stat metadata = {0};
  size_t size = 0;
  char *original = NULL;
  if (creating) {
    struct stat existing;
    if (!fstatat(parent_fd, component, &existing, AT_SYMLINK_NOFOLLOW) || errno != ENOENT) fail("path-rejected");
    metadata.st_mode = thumbnail_create ? 0600 : 0644;
  } else {
    fd = openat(parent_fd, component, O_RDONLY | O_NONBLOCK | O_NOFOLLOW | O_CLOEXEC);
    if (fd < 0) fail(errno == ENOENT ? "file-not-found" : "path-rejected");
    original = read_source(fd, &size, &metadata);
    if ((thumbnail_read || thumbnail_write) && size > 96 * 1024) fail("path-rejected");
  }
  if (!strcmp(argv[1], "read") || css_read || audit_read || thumbnail_read) {
    printf("OK %u %zu\n", (unsigned)(metadata.st_mode & 07777), size);
    if (fwrite(original, 1, size, stdout) != size) fail("read-failed");
    return 0;
  }
  puts("READY");
  fflush(stdout);
  size_t expected_size, replacement_size;
  char *expected = receive(&expected_size);
  char *replacement = receive(&replacement_size);
  if (size != expected_size || (size && memcmp(original, expected, size))) fail("stale-file");
  verify_parent(root, relative);
  if (!creating) verify(fd, component, &metadata, expected, expected_size);
  if (backing && (replacement_size != size || memcmp(original, replacement, size))) fail("invalid-request");
  uint64_t random;
  if (getentropy(&random, sizeof(random))) fail("write-failed");
  snprintf(temp_name, sizeof(temp_name), ".allstudio-%016llx.tmp", (unsigned long long)random);
  int temp = openat(parent_fd, temp_name, O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (temp < 0) { temp_name[0] = '\0'; fail("write-failed"); }
  if (fstat(temp, &owned_temp)) fail("write-failed");
  owns_temp = 1;
  size_t offset = 0;
  while (offset < replacement_size) {
    ssize_t written = write(temp, replacement + offset, replacement_size - offset);
    if (written <= 0) fail("write-failed");
    offset += (size_t)written;
  }
  if (fchmod(temp, metadata.st_mode & 07777) || fsync(temp)) fail("write-failed");
  struct stat prepared;
  if (fstat(temp, &prepared)) fail("write-failed");
  puts("PREPARED");
  fflush(stdout);
  if (getchar() != 'C') fail("write-failed");
  verify_parent(root, relative);
  if (!creating) verify(fd, component, &metadata, expected, expected_size);
  verify(temp, temp_name, &prepared, replacement, replacement_size);
  char backup_name[80];
  const char *target = component;
  if (backing) {
    snprintf(backup_name, sizeof(backup_name), "next.config.allstudio-original%s", strrchr(component, '.'));
    target = backup_name;
  }
  if (creating || backing) {
#if defined(__APPLE__)
    if (renameatx_np(parent_fd, temp_name, parent_fd, target, RENAME_EXCL)) fail("write-failed");
#elif defined(__linux__)
    if (syscall(SYS_renameat2, parent_fd, temp_name, parent_fd, target, RENAME_NOREPLACE)) fail("write-failed");
#else
#error Unsupported native platform
#endif
    published = 1;
  } else {
    if (renameat(parent_fd, temp_name, parent_fd, target)) fail("write-failed");
    published = 1;
  }
  temp_name[0] = '\0';
  verify(temp, target, &prepared, replacement, replacement_size);
  if (close(temp)) fail("durability-unknown");
  if (fsync(parent_fd)) fail("durability-unknown");
  puts("OK");
  return 0;
}
