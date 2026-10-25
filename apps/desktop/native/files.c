/* Original allstudio helper. Directory-relative operations never follow symlinks.
 * The granting parent must pass its pinned root directory as descriptor 3.
 * Protocol: argv read|write root relative; writes receive length\nbytes twice
 * (expected and replacement). READY precedes input; PREPARED waits for C to
 * commit. Output ends with OK [mode length]\n[bytes] or ERR reason.
 */
#define _DARWIN_C_SOURCE
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/random.h>
#include <sys/stat.h>
#include <unistd.h>

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
      (entry.st_mode & 0777) != (original->st_mode & 0777) || !same_inode(original, &entry)) fail("stale-file");
  size_t size;
  char *bytes = read_source(fd, &size, &current);
  if (!same_inode(original, &current) ||
      (current.st_mode & 0777) != (original->st_mode & 0777) || size != expected_size || memcmp(bytes, expected, size)) fail("stale-file");
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
int main(int argc, char **argv) {
  if (argc != 4 || (strcmp(argv[1], "read") && strcmp(argv[1], "write"))) fail("invalid-request");
  const char *root = argv[2], *relative = argv[3];
  size_t length = strlen(relative);
  if (length > 1024 || length < 9 || strncmp(relative, "src/", 4) ||
      strchr(relative, '\\') || strchr(relative, ':') ||
      (strcmp(relative + length - 4, ".tsx") && strcmp(relative + length - 4, ".jsx"))) fail("path-rejected");
  char *canonical = realpath(root, NULL);
  if (!canonical || strcmp(canonical, root)) fail("path-rejected");
  free(canonical);
  struct stat granted, visible;
  if (fstat(3, &granted) || !S_ISDIR(granted.st_mode) || stat(root, &visible) || !same_inode(&granted, &visible)) fail("path-rejected");
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
  int fd = openat(parent_fd, component, O_RDONLY | O_NONBLOCK | O_NOFOLLOW | O_CLOEXEC);
  if (fd < 0) fail(errno == ENOENT ? "file-not-found" : "path-rejected");
  struct stat metadata;
  size_t size;
  char *original = read_source(fd, &size, &metadata);
  if (!strcmp(argv[1], "read")) {
    printf("OK %u %zu\n", (unsigned)(metadata.st_mode & 0777), size);
    if (fwrite(original, 1, size, stdout) != size) fail("read-failed");
    return 0;
  }
  puts("READY");
  fflush(stdout);
  size_t expected_size, replacement_size;
  char *expected = receive(&expected_size);
  char *replacement = receive(&replacement_size);
  if (size != expected_size || memcmp(original, expected, size)) fail("stale-file");
  verify_parent(root, relative);
  verify(fd, component, &metadata, expected, expected_size);
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
  if (fchmod(temp, metadata.st_mode & 0777) || fsync(temp)) fail("write-failed");
  struct stat prepared;
  if (fstat(temp, &prepared)) fail("write-failed");
  puts("PREPARED");
  fflush(stdout);
  if (getchar() != 'C') fail("write-failed");
  verify_parent(root, relative);
  verify(fd, component, &metadata, expected, expected_size);
  verify(temp, temp_name, &prepared, replacement, replacement_size);
  if (renameat(parent_fd, temp_name, parent_fd, component)) fail("write-failed");
  published = 1;
  temp_name[0] = '\0';
  verify(temp, component, &prepared, replacement, replacement_size);
  if (close(temp)) fail("durability-unknown");
  if (fsync(parent_fd)) fail("durability-unknown");
  puts("OK");
  return 0;
}
