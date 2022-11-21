# Deprecation Notice

NorthstarMasterServer has been deprecated, and has been by replaced by [Atlas](https://github.com/R2Northstar/Atlas).

# NorthstarMasterServer

The master server is responsible for centralizing game servers created by players, it also verifies that connecting players own an Origin account with Titanfall 2.

### Format

This project uses `eslint` to format code, make sure you run `eslint --fix .` before opening a Pull Request.

## Using With Docker
1) Build your image - `docker build -t northstarmasterserver .`
2) Run it in a container using the following code -`docker run -it -p 8080:80 -v $(pwd):/app northstarmasterserver <script>`

A little explanation of the run command arguments -
1. `-it` - Interactive mode, optionally you can use `-d` to run it in detached mode
2. `-p 8080:80` - While debugging using Docker port 80 is not allowed for obvious reasons hence we expose the container's port 80 to the host's port 8080
3. `-v $(pwd):/app` - It maps a virtual directory from the host machine (`$(pwd)`) to the specified folder in the Docker image (`/app`), meaning that the docker image sees the contents of the hosts directory in runtime (on-the-fly) without having to rebuild the image
4. `northstarmasterserver` - The image tag name as mentioned when building it
5. `<script>` - This should be replaced by any one scripts such as **start**, **watch** etc from *package.json*

Alternatively the above commands can also be used as-is with `podman`.
